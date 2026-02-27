@ECHO OFF
SETLOCAL ENABLEDELAYEDEXPANSION

REM ===== MarkLogic connection =====
SET "ML_HOST=localhost"
SET "ML_PORT=8004"
SET "ML_USER=corticonml-admin"
SET "ML_PASS=corticonml-admin"

REM ===== Collections =====
SET "COLLECTION=http://example.com/data/eligibility-trace"

REM ===== Input folder =====
SET "DATA_DIR=%CD%\data\split-trace"
IF NOT EXIST "%DATA_DIR%" (
  ECHO Split trace folder not found: "%DATA_DIR%"
  EXIT /B 1
)

ECHO.
ECHO Loading split trace docs from: %DATA_DIR%
ECHO.

SET /A COUNT=0

FOR %%F IN ("%DATA_DIR%\*.json") DO (
  SET "FILENAME=%%~nxF"
  SET "URI=/eligibility-trace/household/!FILENAME!"

  ECHO PUT !URI!

  curl --silent --show-error --fail --location ^
    --request PUT "http://%ML_HOST%:%ML_PORT%/v1/documents?uri=!URI!&perm:corticonml-reader=read&perm:corticonml-writer=update&collection=%COLLECTION%" ^
    --header "Content-Type: application/json" ^
    --digest --user %ML_USER%:%ML_PASS% ^
    --data-binary "@%%F"

  IF ERRORLEVEL 1 (
    ECHO Failed loading: %%F
    EXIT /B 1
  )

  SET /A COUNT+=1
)

ECHO.
ECHO Trace load complete. Loaded %COUNT% documents.
ENDLOCAL
PAUSE
