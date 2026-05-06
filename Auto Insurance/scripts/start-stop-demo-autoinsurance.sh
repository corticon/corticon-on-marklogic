#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Auto Insurance Demo Manager — Linux / macOS
# ---------------------------------------------------------------------------
# This script lives in: Auto Insurance/scripts/
# So the parent is:     Auto Insurance/
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_PATH="$DEMO_ROOT/insurance-chatbot"
FRONTEND_PATH="$BACKEND_PATH/ui"
PID_FILE="$SCRIPT_DIR/.demo-pids"

BACKEND_PORT=4004
FRONTEND_PORT=5173

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

port_in_use() {
    lsof -iTCP:"$1" -sTCP:LISTEN -t &>/dev/null
}

open_browser() {
    local url="$1"
    if command -v xdg-open &>/dev/null; then
        xdg-open "$url"
    elif command -v open &>/dev/null; then   # macOS
        open "$url"
    else
        echo "  Could not detect a browser opener. Navigate manually to: $url"
    fi
}

show_menu() {
    clear
    echo "============================================"
    echo "    Auto Insurance Demo Manager"
    echo "============================================"
    echo "1. Start Demo"
    echo "2. Stop Demo"
    echo "Q. Quit"
    echo "============================================"
    echo ""
}

# ---------------------------------------------------------------------------
# Start
# ---------------------------------------------------------------------------

start_demo() {
    # Pre-flight: prevent double start
    if [[ -f "$PID_FILE" ]]; then
        echo "[WARN] PID file found ($PID_FILE)."
        echo "       The demo might already be running. Use 'Stop Demo' first."
        sleep 2
        return
    fi

    for port in $BACKEND_PORT $FRONTEND_PORT; do
        if port_in_use "$port"; then
            echo "[ERROR] Port $port is already in use."
            echo "        Stop the existing process before starting the demo."
            sleep 2
            return
        fi
    done

    # Validate paths
    if [[ ! -d "$BACKEND_PATH" ]]; then
        echo "[ERROR] Backend path not found: $BACKEND_PATH"
        return 1
    fi
    if [[ ! -d "$FRONTEND_PATH" ]]; then
        echo "[ERROR] Frontend path not found: $FRONTEND_PATH"
        return 1
    fi

    echo "Starting Demo components..."

    # Start backend in a new terminal window (falls back to background process)
    echo "Launching Backend Server (port $BACKEND_PORT)..."
    if command -v gnome-terminal &>/dev/null; then
        gnome-terminal --title="AutoInsurance-Backend-Server" -- bash -c "cd '$BACKEND_PATH' && npm start; exec bash" &
        BACKEND_TERM_PID=$!
    elif command -v xterm &>/dev/null; then
        xterm -title "AutoInsurance-Backend-Server" -e "cd '$BACKEND_PATH' && npm start; bash" &
        BACKEND_TERM_PID=$!
    else
        # Fallback: run in background, log to file
        (cd "$BACKEND_PATH" && npm start) >> "$SCRIPT_DIR/backend.log" 2>&1 &
        BACKEND_TERM_PID=$!
        echo "  [INFO] No terminal emulator found; backend running in background (log: scripts/backend.log)"
    fi

    # Start frontend in a new terminal window
    echo "Launching Frontend UI (port $FRONTEND_PORT)..."
    if command -v gnome-terminal &>/dev/null; then
        gnome-terminal --title="AutoInsurance-React-UI" -- bash -c "cd '$FRONTEND_PATH' && npm run dev; exec bash" &
        FRONTEND_TERM_PID=$!
    elif command -v xterm &>/dev/null; then
        xterm -title "AutoInsurance-React-UI" -e "cd '$FRONTEND_PATH' && npm run dev; bash" &
        FRONTEND_TERM_PID=$!
    else
        (cd "$FRONTEND_PATH" && npm run dev) >> "$SCRIPT_DIR/frontend.log" 2>&1 &
        FRONTEND_TERM_PID=$!
        echo "  [INFO] No terminal emulator found; frontend running in background (log: scripts/frontend.log)"
    fi

    # Save PIDs
    echo "BACKEND_PID=$BACKEND_TERM_PID"   > "$PID_FILE"
    echo "FRONTEND_PID=$FRONTEND_TERM_PID" >> "$PID_FILE"

    echo "Backend PID:  $BACKEND_TERM_PID"
    echo "Frontend PID: $FRONTEND_TERM_PID"

    # Wait for services then open browser
    echo "Waiting 10 seconds for services to initialize..."
    sleep 10

    echo "Opening browser at http://localhost:$FRONTEND_PORT/ ..."
    open_browser "http://localhost:$FRONTEND_PORT/"
}

# ---------------------------------------------------------------------------
# Stop
# ---------------------------------------------------------------------------

stop_demo() {
    echo "Stopping Demo processes..."

    if [[ -f "$PID_FILE" ]]; then
        # shellcheck source=/dev/null
        source "$PID_FILE"

        if [[ -n "${BACKEND_PID:-}" ]]; then
            echo "Stopping Backend (PID: $BACKEND_PID)..."
            kill "$BACKEND_PID" 2>/dev/null || echo "  Process $BACKEND_PID not active."
        fi
        if [[ -n "${FRONTEND_PID:-}" ]]; then
            echo "Stopping Frontend (PID: $FRONTEND_PID)..."
            kill "$FRONTEND_PID" 2>/dev/null || echo "  Process $FRONTEND_PID not active."
        fi

        rm -f "$PID_FILE"
        echo "PID cleanup complete."
    else
        echo "[INFO] No PID file found. Falling back to port-based cleanup."
    fi

    # Fallback: kill by port
    for port in $BACKEND_PORT $FRONTEND_PORT; do
        if port_in_use "$port"; then
            echo "Killing process on port $port..."
            lsof -iTCP:"$port" -sTCP:LISTEN -t | xargs -r kill -9
        fi
    done

    # Wait for ports to be released
    echo "Waiting for ports to be released..."
    local max_wait=10
    local elapsed=0
    while (( elapsed < max_wait )); do
        sleep 1
        (( elapsed++ )) || true
        if ! port_in_use $BACKEND_PORT && ! port_in_use $FRONTEND_PORT; then
            echo "All ports released after ${elapsed}s."
            break
        fi
        echo "  Waiting... (${elapsed}/${max_wait}s)"
    done

    if port_in_use $BACKEND_PORT || port_in_use $FRONTEND_PORT; then
        echo "[WARN] Some ports may still be in use. Wait a moment before restarting."
        port_in_use $BACKEND_PORT && echo "  - Port $BACKEND_PORT (Backend) still in use"
        port_in_use $FRONTEND_PORT && echo "  - Port $FRONTEND_PORT (Frontend) still in use"
    fi

    echo "Stop sequence complete."
}

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

while true; do
    show_menu
    read -rp "Select an option: " selection
    case "$selection" in
        1) start_demo ;;
        2) stop_demo  ;;
        Q|q) echo "Exiting..."; exit 0 ;;
        *) echo "Invalid option. Please try again."; sleep 1 ;;
    esac
done
