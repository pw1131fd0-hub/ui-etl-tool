#!/bin/bash
# UI ETL Tool - Start All Services

echo "[1/3] Starting PostgreSQL & Redis (Docker)..."
docker start etl-postgres etl-redis 2>/dev/null || echo "Docker containers already running"

echo "[2/3] Starting Backend (port 3005)..."
cd /home/crawd_user/project/ui-etl-tool
pkill -f "tsx src/backend/index.ts" 2>/dev/null
nohup npx tsx src/backend/index.ts > backend.log 2>&1 &
sleep 2

echo "[3/3] Starting Frontend (port 5173)..."
cd /home/crawd_user/project/ui-etl-tool
nohup npx vite --port 5173 --host 0.0.0.0 > frontend.log 2>&1 &
sleep 3

echo "✅ All services started"
curl -s http://localhost:3005/api/auth/me > /dev/null 2>&1 && echo "  Backend: ✅" || echo "  Backend: ❌"
curl -s http://localhost:5173 > /dev/null 2>&1 && echo "  Frontend: ✅" || echo "  Frontend: ❌"
