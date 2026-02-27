@ECHO OFF
SETLOCAL ENABLEDELAYEDEXPANSION

REM ===== MarkLogic connection =====
SET "ML_HOST=localhost"
SET "ML_PORT=8004"
SET "ML_USER=corticonml-admin"
SET "ML_PASS=corticonml-admin"

REM ===== Collections =====
SET "COLLECTION=http://example.com/data/eligibility-output"

REM ===== Input folder =====
SET "DATA_DIR=%CD%\data\split-output"
IF NOT EXIST "%DATA_DIR%" (
  ECHO Split output folder not found: "%DATA_DIR%"
  EXIT /B 1
)

REM ===== Optional: clear existing docs in this URI space (manual step) =====
REM We’ll skip auto-delete here for safety.

ECHO.
ECHO Loading split output docs from: %DATA_DIR%
ECHO.

SET /A COUNT=0

FOR %%F IN ("%DATA_DIR%\*.json") DO (
  SET "FILENAME=%%~nxF"
  SET "URI=/eligibility-output/household/!FILENAME!"

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
ECHO Output load complete. Loaded %COUNT% documents.
ENDLOCAL
PAUSE
