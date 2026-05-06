$ErrorActionPreference = "Stop"

# Define paths relative to this script location.
# This script lives in: Auto Insurance/scripts/
# So the parent is:     Auto Insurance/
$ScriptPath  = $PSScriptRoot
$DemoRoot    = (Get-Item $ScriptPath).Parent.FullName
$BackendPath = Join-Path $DemoRoot "insurance-chatbot"
$FrontendPath = Join-Path $BackendPath "ui"
$PidFile = Join-Path $ScriptPath ".demo-pids.json"

# Define Window Titles for identification (visual aid only)
$BackendTitle  = "AutoInsurance-Backend-Server"
$FrontendTitle = "AutoInsurance-React-UI"

function Show-Menu {
    Clear-Host
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "    Auto Insurance Demo Manager" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "1. Start Demo"
    Write-Host "2. Stop Demo"
    Write-Host "Q. Quit"
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
}

function Start-Demo {
    # --- PRE-FLIGHT CHECK: Prevent double start ---
    if (Test-Path $PidFile) {
        Write-Host "PID file found ($PidFile)." -ForegroundColor Yellow
        Write-Host "The demo might already be running. Please use 'Stop Demo' first." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        return
    }

    $ports = @(4004, 5173)
    foreach ($port in $ports) {
        if (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue) {
            Write-Host "Port $port is already in use." -ForegroundColor Red
            Write-Host "The demo (or another process) is already running. Please check and stop it first." -ForegroundColor Red
            Start-Sleep -Seconds 2
            return
        }
    }

    Write-Host "Starting Demo components..." -ForegroundColor Green

    if (-not (Test-Path $BackendPath)) {
        Write-Error "Backend path not found at: $BackendPath"
        return
    }
    if (-not (Test-Path $FrontendPath)) {
        Write-Error "Frontend path not found at: $FrontendPath"
        return
    }

    $pids = @{}

    # Start Backend (CMD window)
    Write-Host "Launching Backend Server..."
    $BackendCommand = "/k title $BackendTitle && cd /d ""$BackendPath"" && npm start"
    $backendProcess = Start-Process cmd.exe -ArgumentList $BackendCommand -PassThru
    $pids["Backend"] = $backendProcess.Id

    # Start Frontend (CMD window)
    Write-Host "Launching Frontend UI..."
    $FrontendCommand = "/k title $FrontendTitle && cd /d ""$FrontendPath"" && npm run dev"
    $frontendProcess = Start-Process cmd.exe -ArgumentList $FrontendCommand -PassThru
    $pids["Frontend"] = $frontendProcess.Id

    # Save PIDs to file
    $pids | ConvertTo-Json | Set-Content -Path $PidFile

    Write-Host "Components launched in new CMD windows." -ForegroundColor Green
    Write-Host "Backend PID:  $($backendProcess.Id)" -ForegroundColor Gray
    Write-Host "Frontend PID: $($frontendProcess.Id)" -ForegroundColor Gray

    # Auto-launch browser after giving services time to start
    Write-Host "Waiting 10 seconds for services to initialize..." -ForegroundColor Cyan
    Start-Sleep -Seconds 10

    Write-Host "Opening browser..." -ForegroundColor Cyan
    $Url = "http://localhost:5173/"
    try {
        Start-Process "chrome.exe" $Url -ErrorAction Stop
    }
    catch {
        Write-Host "Chrome not found in PATH, opening default browser..." -ForegroundColor Yellow
        Start-Process $Url
    }
}

function Stop-Demo {
    Write-Host "Stopping Demo processes..." -ForegroundColor Yellow

    if (Test-Path $PidFile) {
        try {
            $savedPids = Get-Content -Path $PidFile | ConvertFrom-Json

            if ($savedPids.Backend) {
                $id = $savedPids.Backend
                Write-Host "Stopping Backend (PID: $id)..."
                try { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue } catch { Write-Host "Process $id not active." -ForegroundColor Gray }
            }

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

    # Fallback 1: Kill by port
    Write-Host "Checking for processes on ports 4004 (Backend) and 5173 (Frontend)..." -ForegroundColor Cyan
    $ports = @(4004, 5173)
    foreach ($port in $ports) {
        $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        foreach ($conn in $conns) {
            $procId = $conn.OwningProcess
            if ($procId) {
                Write-Host "Found process on port $port (PID: $procId). Stopping..." -ForegroundColor Yellow
                try {
                    $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $procId" -ErrorAction SilentlyContinue
                    if ($parent) {
                        $parentId = $parent.ParentProcessId
                        Write-Host " - Stopping parent window (PID: $parentId)..." -ForegroundColor DarkGray
                        Stop-Process -Id $parentId -Force -ErrorAction SilentlyContinue
                    }
                } catch {}
                try { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue } catch {}
            }
        }
    }

    # Fallback 2: Kill by window title
    Write-Host "Closing remaining windows by title..." -ForegroundColor Cyan
    try {
        $null = taskkill /F /FI "WINDOWTITLE eq $BackendTitle*" /T 2>&1
        $null = taskkill /F /FI "WINDOWTITLE eq $FrontendTitle*" /T 2>&1
    } catch {}

    # Wait for ports to be released
    Write-Host "Waiting for ports to be released..." -ForegroundColor Cyan
    $maxWaitSeconds = 10
    $waitInterval   = 1
    $elapsed         = 0
    $portsReleased   = $false

    while ($elapsed -lt $maxWaitSeconds) {
        Start-Sleep -Seconds $waitInterval
        $elapsed += $waitInterval

        $port4004 = Get-NetTCPConnection -LocalPort 4004 -ErrorAction SilentlyContinue
        $port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue

        if (-not $port4004 -and -not $port5173) {
            $portsReleased = $true
            Write-Host "All ports released after $elapsed seconds." -ForegroundColor Green
            break
        }
        Write-Host "  Waiting... ($elapsed/$maxWaitSeconds seconds)" -ForegroundColor DarkGray
    }

    if (-not $portsReleased) {
        Write-Host "Warning: Some ports may still be in use. Wait a moment before restarting." -ForegroundColor Yellow
        if (Get-NetTCPConnection -LocalPort 4004 -ErrorAction SilentlyContinue) {
            Write-Host "  - Port 4004 (Backend) still in use" -ForegroundColor Yellow
        }
        if (Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue) {
            Write-Host "  - Port 5173 (Frontend) still in use" -ForegroundColor Yellow
        }
    }

    Write-Host "Stop sequence complete." -ForegroundColor Green
    Write-Host "Press any key to continue..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Main loop
do {
    Show-Menu
    $selection = Read-Host "Select an option"

    switch ($selection) {
        '1' { Start-Demo }
        '2' { Stop-Demo }
        'Q' { Write-Host "Exiting..."; exit }
        default {
            Write-Host "Invalid option. Please try again." -ForegroundColor Red
            Start-Sleep -Seconds 1
        }
    }
} until ($selection -eq 'Q')
