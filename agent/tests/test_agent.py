"""Run with: python3 -m unittest discover -s agent/tests -v"""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from agent import main as agent

TOKEN = "testing-agent-token-only-for-unit-tests-123456789"


class AgentTests(unittest.TestCase):
    def test_ffmpeg_argv_is_shell_free_and_selects_correct_hls_mode(self):
        settings = agent.Settings("http://localhost:3000", TOKEN, 1, Path("/tmp/hls-test"), "/usr/bin/ffmpeg", 10)
        source = "https://example.com/media.mp4?query=hello;touch /tmp/unsafe"
        live = agent.ffmpeg_command(settings, 42, source, "live")
        vod = agent.ffmpeg_command(settings, 42, source, "vod")
        self.assertEqual(live[live.index("-i") + 1], source)
        self.assertIn("delete_segments+temp_file", live)
        self.assertIn("vod", vod)
        self.assertIn("-hls_playlist_type", vod)
        self.assertEqual(vod[-1], "/tmp/hls-test/42/index.m3u8")

    def test_hls_requires_agent_token_and_approved_filename(self):
        with tempfile.TemporaryDirectory() as temporary_root:
            environment = {
                "AGENT_TOKEN": TOKEN,
                "FFMPEG_BIN": "true",  # Installed by coreutils; no FFmpeg subprocess is started.
                "PANEL_URL": "http://127.0.0.1:9",
                "HLS_ROOT": temporary_root,
                "NODE_ID": "1",
            }
            with patch.dict(os.environ, environment):
                with TestClient(agent.app) as client:
                    self.assertEqual(client.get("/health").status_code, 200)
                    self.assertEqual(client.get("/hls/1/index.m3u8").status_code, 401)
                    directory = Path(temporary_root) / "1"
                    directory.mkdir()
                    (directory / "index.m3u8").write_text("#EXTM3U\n#EXT-X-ENDLIST\n", encoding="utf-8")
                    (directory / "segment_000001.ts").write_bytes(b"test")
                    assert agent.manager is not None
                    agent.manager.running[1] = agent.RunningStream("https://example.com/video.mp4", "vod")
                    headers = {"Authorization": f"Bearer {TOKEN}"}
                    self.assertEqual(client.get("/hls/1/index.m3u8", headers=headers).status_code, 200)
                    self.assertEqual(client.get("/hls/1/segment_000001.ts", headers=headers).content, b"test")
                    self.assertEqual(client.get("/hls/1/passwords.txt", headers=headers).status_code, 404)
                    self.assertEqual(client.get("/hls/2/index.m3u8", headers=headers).status_code, 404)


if __name__ == "__main__":
    unittest.main()
