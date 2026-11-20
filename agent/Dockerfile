FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY agent/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY agent/main.py ./main.py

RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin madar \
    && mkdir -p /var/lib/madar/hls && chown -R madar:madar /var/lib/madar
USER madar
EXPOSE 9000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9000", "--no-access-log"]
