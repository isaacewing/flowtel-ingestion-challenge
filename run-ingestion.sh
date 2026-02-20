#!/bin/bash
set -e
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy .env.example to .env and fill in values."
  exit 1
fi
echo "Starting Flowtel ingestion pipeline..."
docker compose down ingestion 2>/dev/null || true
docker compose up --build --abort-on-container-exit ingestion
