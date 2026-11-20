"""Madar streaming node. Python 3.12+; no legacy Xtream binaries required."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import re
import secrets
import shutil
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("madar.agent")
FILENAME_PATTERN = re.compile(r"^(index\.m3u8|segment_[0-9]+\.ts)$")


@dataclass(frozen=True)
class Settings:
    panel_url: str
    token: str
    node_id: int
    root: Path
    ffmpeg: str
    poll_seconds: int

    @classmethod
    def from_environment(cls) -> Settings:
        token = os.getenv("AGENT_TOKEN", "")
        if len(token) < 24:
            raise RuntimeError("AGENT_TOKEN must be at least 24 characters")
        ffmpeg = shutil.which(os.getenv("FFMPEG_BIN", "ffmpeg"))
        if not ffmpeg:
            raise RuntimeError("FFmpeg is not installed")
        node_id = int(os.getenv("NODE_ID", "1"))
        if node_id < 1:
            raise RuntimeError("NODE_ID must be positive")
        return cls(
            panel_url=os.getenv("PANEL_URL", "http://panel:3000").rstrip("/"),
            token=token,
            node_id=node_id,
            root=Path(os.getenv("HLS_ROOT", "/var/lib/madar/hls")),
            ffmpeg=ffmpeg,
            poll_seconds=max(5, int(os.getenv("POLL_SECONDS", "10"))),
        )


@dataclass
class RunningStream:
    source_url: str
    kind: str
    process: asyncio.subprocess.Process | None = None
    last_start: float = 0


def ffmpeg_command(settings: Settings, stream_id: int, source_url: str, kind: str) -> list[str]:
    """Build an argv array; sources are never interpolated into a shell command."""
    directory = settings.root / str(stream_id)
    command = [
        settings.ffmpeg, "-hide_banner", "-nostdin", "-loglevel", "error", "-y",
        "-i", source_url, "-map", "0:v:0?", "-map", "0:a:0?", "-c", "copy",
        "-f", "hls", "-hls_time", "6",
    ]
    if kind == "vod":
        command += ["-hls_playlist_type", "vod", "-hls_list_size", "0", "-hls_flags", "temp_file"]
    else:
        command += ["-hls_list_size", "6", "-hls_flags", "delete_segments+temp_file"]
    command += ["-hls_segment_filename", str(directory / "segment_%06d.ts"), str(directory / "index.m3u8")]
    return command


class StreamManager:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.running: dict[int, RunningStream] = {}

    async def stop(self, stream_id: int, remove_files: bool = False) -> None:
        state = self.running.pop(stream_id, None)
        if state and state.process and state.process.returncode is None:
            state.process.terminate()
            try:
                await asyncio.wait_for(state.process.wait(), timeout=5)
            except asyncio.TimeoutError:
                state.process.kill()
                await state.process.wait()
        if remove_files:
            directory = self.settings.root / str(stream_id)
            shutil.rmtree(directory, ignore_errors=True)

    async def sync(self, desired: list[dict]) -> None:
        streams_by_id: dict[int, dict] = {}
        for item in desired:
            if not isinstance(item, dict) or not isinstance(item.get("id"), int):
                continue
            source = item.get("sourceUrl")
            kind = item.get("kind")
            if not isinstance(source, str) or urlsplit(source).scheme not in {"http", "https"} or kind not in {"live", "vod"}:
                continue
            streams_by_id[item["id"]] = item

        for stream_id in list(self.running):
            old = self.running[stream_id]
            updated = streams_by_id.get(stream_id)
            if not updated or updated["sourceUrl"] != old.source_url or updated["kind"] != old.kind:
                await self.stop(stream_id, remove_files=True)

        for stream_id, item in streams_by_id.items():
            state = self.running.get(stream_id)
            if state is None:
                state = RunningStream(source_url=item["sourceUrl"], kind=item["kind"])
                self.running[stream_id] = state
            directory = self.settings.root / str(stream_id)
            playlist = directory / "index.m3u8"
            if state.kind == "vod" and playlist.exists():
                # A completed VOD survives a restart; incomplete output is rebuilt.
                if "#EXT-X-ENDLIST" in playlist.read_text(encoding="utf-8", errors="replace"):
                    continue
            if state.process is not None and state.process.returncode is None:
                continue
            if time.monotonic() - state.last_start < 15:
                continue  # Back off when an upstream source fails repeatedly.
            if directory.exists():
                shutil.rmtree(directory, ignore_errors=True)
            directory.mkdir(parents=True, exist_ok=True)
            state.last_start = time.monotonic()
            state.process = await asyncio.create_subprocess_exec(
                *ffmpeg_command(self.settings, stream_id, state.source_url, state.kind),
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            logger.info("Started stream %s (%s)", stream_id, state.kind)

    def health(self) -> list[dict]:
        result = []
        for stream_id, state in self.running.items():
            playlist = self.settings.root / str(stream_id) / "index.m3u8"
            if state.kind == "vod" and playlist.exists() and "#EXT-X-ENDLIST" in playlist.read_text(encoding="utf-8", errors="replace"):
                status = "online"
            elif state.process is not None and state.process.returncode is not None:
                status = "error"
            elif playlist.exists():
                status = "online"
            else:
                status = "pending"
            result.append({"id": stream_id, "health": status})
        return result

    async def shutdown(self) -> None:
        for stream_id in list(self.running):
            await self.stop(stream_id)


settings: Settings | None = None
manager: StreamManager | None = None


async def synchronization_loop(client: httpx.AsyncClient, stream_manager: StreamManager) -> None:
    config = stream_manager.settings
    while True:
        try:
            response = await client.get("/api/agent/sync", params={"node_id": config.node_id})
            response.raise_for_status()
            await stream_manager.sync(response.json()["streams"])
            heartbeat = await client.post("/api/agent/heartbeat", json={
                "nodeId": config.node_id,
                "streams": stream_manager.health(),
            })
            heartbeat.raise_for_status()
        except asyncio.CancelledError:
            raise
        except (httpx.HTTPError, KeyError, ValueError, OSError) as exc:
            # Do not log response bodies or source URLs: they can contain secrets.
            logger.warning("Panel sync failed (%s)", type(exc).__name__)
        await asyncio.sleep(config.poll_seconds)


@asynccontextmanager
async def lifespan(_: FastAPI):
    global settings, manager
    settings = Settings.from_environment()
    settings.root.mkdir(parents=True, exist_ok=True)
    manager = StreamManager(settings)
    async with httpx.AsyncClient(
        base_url=settings.panel_url,
        headers={"Authorization": f"Bearer {settings.token}"},
        timeout=10.0,
    ) as client:
        task = asyncio.create_task(synchronization_loop(client, manager))
        logger.info("Node %s started", settings.node_id)
        try:
            yield
        finally:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
            await manager.shutdown()
            manager = None
            settings = None


app = FastAPI(title="Madar Stream Agent", version="1.0.0", docs_url=None, redoc_url=None, lifespan=lifespan)


@app.get("/health")
async def healthcheck():
    return {"ok": True, "nodeId": settings.node_id if settings else None, "streams": len(manager.running) if manager else 0}


@app.get("/hls/{stream_id}/{filename}")
async def get_hls(stream_id: int, filename: str, authorization: str | None = Header(default=None)):
    if not settings or not authorization or not secrets.compare_digest(authorization, f"Bearer {settings.token}"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    if stream_id < 1 or not FILENAME_PATTERN.fullmatch(filename):
        raise HTTPException(status_code=404, detail="Not found")
    path = settings.root / str(stream_id) / filename
    if not path.is_file() or not manager or stream_id not in manager.running:
        raise HTTPException(status_code=404, detail="Not found")
    is_playlist = filename.endswith(".m3u8")
    return FileResponse(
        path,
        media_type="application/vnd.apple.mpegurl" if is_playlist else "video/mp2t",
        headers={"Cache-Control": "no-store" if is_playlist else "private, max-age=15"},
    )
