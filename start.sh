#!/bin/bash

# SolarTrack Development Server Startup Script

# Store PIDs for cleanup
PIDS=()

cleanup() {
    echo ""
    echo "Stopping servers..."

    # Kill all child processes
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill -TERM "$pid" 2>/dev/null
        fi
    done

    # Kill any remaining uvicorn/node processes started by this script
    pkill -P $$ 2>/dev/null

    # Wait a moment for graceful shutdown
    sleep 1

    # Force kill if still running
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null
        fi
    done

    echo "All servers stopped."
    exit 0
}

# Set up trap for Ctrl+C and other termination signals
trap cleanup SIGINT SIGTERM EXIT

echo "Starting SolarTrack development servers..."
echo ""

# Start Backend (FastAPI)
echo "Starting backend..."
(cd apps/api && source venv/bin/activate && uvicorn app.main:app --reload) &
PIDS+=($!)

# Give backend a moment to start
sleep 2

# Start Frontend (Next.js)
echo "Starting frontend..."
(cd apps/web && pnpm dev) &
PIDS+=($!)

# Wait for servers to initialize
sleep 3

echo ""
echo "========================================="
echo "  SolarTrack Development Servers"
echo "========================================="
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo "========================================="
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for all background processes
wait
