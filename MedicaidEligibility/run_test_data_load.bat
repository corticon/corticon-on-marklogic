@ECHO OFF
SETLOCAL ENABLEDELAYEDEXPANSION

ECHO =================================================================
ECHO Step 1: Ensuring output folder exists...
ECHO =================================================================
IF NOT EXIST "data\" MKDIR "data"
IF ERRORLEVEL 1 (
  ECHO Failed to create data folder. Aborting.
  EXIT /B 1
)

ECHO =================================================================
ECHO Step 2: Generating 100 new household records from Mockaroo...
ECHO =================================================================
SET "OUTPUT_FILE=%CD%\data\mockaroo_output.json"
SET "MOCKAROO_URL=https://my.api.mockaroo.com/complete_mockaroo_schema_for_medicaid_households.json?key=33ac6ab0&count=100"

REM Try curl if available
WHERE curl >NUL 2>&1
IF %ERRORLEVEL% EQU 0 (
  ECHO Using curl to download test data...
  curl -s -f -o "%OUTPUT_FILE%" "%MOCKAROO_URL%"
) ELSE (
  ECHO curl not found, using PowerShell Invoke-WebRequest...
  powershell -NoProfile -Command "Invoke-WebRequest -Uri '%MOCKAROO_URL%' -OutFile '%OUTPUT_FILE%'"
)

IF NOT EXIST "%OUTPUT_FILE%" (
  ECHO ERROR: Output file not found: "%OUTPUT_FILE%"
  ECHO Download failed or path invalid. Aborting.
  EXIT /B 1
)

FOR %%I IN ("%OUTPUT_FILE%") DO (
  ECHO Test data saved to: "%%~fI"  Size: %%~zI bytes
)

ECHO.
ECHO =================================================================
ECHO Step 3: Ingesting the new household data into MarkLogic (corticonml REST @ 8004)...
ECHO =================================================================
REM Note: import-aggregate-json-files expects a file path; quoting handles spaces in paths.
flux import-aggregate-json-files ^
  --path "%OUTPUT_FILE%" ^
  --connection-string "corticonml-admin:corticonml-admin@localhost:8004" ^
  --permissions corticonml-reader,read,corticonml-writer,update ^
  --collections http://example.com/data/medicaid-input ^
  --uri-template "/input/medicaid/{/householdId}.json"

IF ERRORLEVEL 1 (
  ECHO ERROR: Flux import failed. Consider re-running with --stacktrace for details.
  EXIT /B 1
)

ECHO.
ECHO =================================================================
ECHO Process Complete.
ECHO =================================================================

ENDLOCAL
PAUSE
