$ErrorActionPreference = "Stop"

# Define paths relative to this script location
# Script lives at: PDP-Decision-Management/scripts/
# Portal lives at: PDP-Decision-Management/portal/
$ScriptPath  = $PSScriptRoot
$PortalRoot  = Join-Path (Get-Item $ScriptPath).Parent.FullName "portal"
$BackendPath = Join-Path $PortalRoot "server"
$FrontendPath = $PortalRoot
$PidFile = Join-Path $ScriptPath ".pdp-portal-pids.json"

# Define Window Titles for identification (Visual aid only)
$BackendTitle = "PDP-Portal-Backend-Server"
$FrontendTitle = "PDP-Portal-React-UI"

function Show-Menu {
    Clear-Host
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "    PDP Decision Management Portal Manager" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "1. Start Portal"
    Write-Host "2. Stop Portal"
    Write-Host "Q. Quit"
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
}

function Start-Portal {
    # --- 1. PRE-FLIGHT CHECK: Prevent double start ---
    if (Test-Path $PidFile) {
        Write-Host "PID file found ($PidFile)." -ForegroundColor Yellow
        Write-Host "The portal might already be running. Please use 'Stop Portal' first." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        return
    }

    $ports = @(4005, 5174)
    foreach ($port in $ports) {
        if (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue) {
            Write-Host "Port $port is already in use." -ForegroundColor Red
            Write-Host "The portal (or another process) is already running. Please check and stop it first." -ForegroundColor Red
            Start-Sleep -Seconds 2
            return
        }
    }

    Write-Host "Starting Portal components..." -ForegroundColor Green

    # Check if paths exist
    if (-not (Test-Path $BackendPath)) {
        Write-Error "Backend path not found at: $BackendPath"
        return
    }
    if (-not (Test-Path $FrontendPath)) {
        Write-Error "Frontend path not found at: $FrontendPath"
        return
    }

    # Check if .env files exist
    $backendEnv = Join-Path $BackendPath ".env"
    $frontendEnv = Join-Path $FrontendPath ".env"

    if (-not (Test-Path $backendEnv)) {
        Write-Host "WARNING: Backend .env file not found at: $backendEnv" -ForegroundColor Yellow
        Write-Host "Please copy server/.env.template to server/.env and configure it." -ForegroundColor Yellow
        Write-Host "Press any key to continue anyway or Ctrl+C to cancel..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }

    if (-not (Test-Path $frontendEnv)) {
        Write-Host "WARNING: Frontend .env file not found at: $frontendEnv" -ForegroundColor Yellow
        Write-Host "Please copy portal/.env.template to portal/.env and configure it." -ForegroundColor Yellow
        Write-Host "Press any key to continue anyway or Ctrl+C to cancel..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }

    $pids = @{}

    # Start Backend (CMD)
    Write-Host "Launching Backend Server (Express Proxy)..."
    # cmd /k keeps window open. 'title' sets window title.
    $BackendCommand = "/k title $BackendTitle && cd /d ""$BackendPath"" && npm start"
    $backendProcess = Start-Process cmd.exe -ArgumentList $BackendCommand -PassThru
    $pids["Backend"] = $backendProcess.Id

    # Start Frontend (CMD)
    Write-Host "Launching Frontend UI (Vite)..."
    $FrontendCommand = "/k title $FrontendTitle && cd /d ""$FrontendPath"" && npm run dev"
    $frontendProcess = Start-Process cmd.exe -ArgumentList $FrontendCommand -PassThru
    $pids["Frontend"] = $frontendProcess.Id

    # Save PIDs to file
    $pids | ConvertTo-Json | Set-Content -Path $PidFile

    Write-Host "Components launched in new CMD windows." -ForegroundColor Green
    Write-Host "Backend PID: $($backendProcess.Id)" -ForegroundColor Gray
    Write-Host "Frontend PID: $($frontendProcess.Id)" -ForegroundColor Gray

    # --- 2. AUTO-LAUNCH BROWSER ---
    Write-Host "Waiting 10 seconds for services to initialize..." -ForegroundColor Cyan
    Start-Sleep -Seconds 10

    Write-Host "Opening Chrome..." -ForegroundColor Cyan
    $Url = "http://localhost:5174/"
    try {
        # Try launching Chrome specifically
        Start-Process "chrome.exe" $Url -ErrorAction Stop
    }
    catch {
        Write-Host "Chrome not found in PATH, opening default browser..." -ForegroundColor Yellow
        Start-Process $Url
    }
}

function Stop-Portal {
    Write-Host "Stopping Portal processes..." -ForegroundColor Yellow

    if (Test-Path $PidFile) {
        try {
            $savedPids = Get-Content -Path $PidFile | ConvertFrom-Json

            # Stop Backend by PID
            if ($savedPids.Backend) {
                $id = $savedPids.Backend
                Write-Host "Stopping Backend (PID: $id)..."
                try { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } catch { Write-Host "Process $id not active." -ForegroundColor Gray }
            }

            # Stop Frontend by PID
            if ($savedPids.Frontend) {
                $id = $savedPids.Frontend
                Write-Host "Stopping Frontend (PID: $id)..."
                try { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } catch { Write-Host "Process $id not active." -ForegroundColor Gray }
            }

            Remove-Item -Path $PidFile -Force
            Write-Host "PID cleanup complete." -ForegroundColor Green
        }
        catch {
            Write-Error "Failed to read PID file: $_"
        }
    }

    # --- FALLBACK 1: Network Ports ---
    Write-Host "Checking for processes on ports 4005 (Backend) and 5174 (Frontend)..." -ForegroundColor Cyan
    $ports = @(4005, 5174)
    foreach ($port in $ports) {
        $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        foreach ($conn in $conns) {
            $procId = $conn.OwningProcess
            if ($procId) {
                Write-Host "Found process on port $port (PID: $procId). Stopping..." -ForegroundColor Yellow

                # Try to kill parent process (the CMD window) first
                try {
                    $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $procId" -ErrorAction SilentlyContinue
                    if ($parent) {
                        $parentId = $parent.ParentProcessId
                        Write-Host " - Found Parent Process (PID: $parentId). Stopping parent window..." -ForegroundColor DarkGray
                        Stop-Process -Id $parentId -Force -ErrorAction SilentlyContinue
                    }
                } catch {}

                # Kill the actual process (Node)
                try { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue } catch {}
            }
        }
    }

    Write-Host "Stop sequence complete." -ForegroundColor Green
}

# --- Main loop ---
while ($true) {
    Show-Menu
    $choice = Read-Host "Enter choice"
    switch ($choice.ToUpper()) {
        "1" { Start-Portal }
        "2" { Stop-Portal }
        "Q" { Write-Host "Exiting."; exit }
        default { Write-Host "Invalid choice. Please try again." -ForegroundColor Red; Start-Sleep -Seconds 1 }
    }
}
