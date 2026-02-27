@ECHO OFF
SETLOCAL ENABLEDELAYEDEXPANSION

SET "ML_HOST=localhost"
SET "ML_PORT=8004"
SET "ML_USER=corticonml-admin"
SET "ML_PASS=corticonml-admin"
SET "COLLECTION=http://example.com/data/eligibility-output"

SET "DATA_DIR=%CD%\data"
IF NOT EXIST "%DATA_DIR%" (
  ECHO Data folder not found: "%DATA_DIR%"
  EXIT /B 1
)

IF NOT EXIST "%DATA_DIR%\*.json" (
  ECHO No JSON files found in: "%DATA_DIR%"
  EXIT /B 1
)

WHERE curl >NUL 2>&1
IF %ERRORLEVEL% NEQ 0 (
  ECHO curl not found. Please install curl or use a manual PUT.
  EXIT /B 1
)

FOR %%F IN ("%DATA_DIR%\*.json") DO (
  SET "HOUSEHOLD_ID="
  FOR /F "usebackq delims=" %%H IN (`powershell -NoProfile -Command "(Get-Content -Raw -Path '%%~fF' | ConvertFrom-Json).payload.householdId"`) DO (
    SET "HOUSEHOLD_ID=%%H"
  )

  IF NOT DEFINED HOUSEHOLD_ID (
    SET "HOUSEHOLD_ID=%%~nF"
  )

  SET "URI=/data/eligibility-output/!HOUSEHOLD_ID!.json"

  ECHO Loading %%~nxF as !URI!
  curl --location --request PUT "http://%ML_HOST%:%ML_PORT%/v1/documents?uri=!URI!&perm:corticonml-reader=read&perm:corticonml-writer=update&collection=%COLLECTION%" ^
    --header "Content-Type: application/json" ^
    --digest --user %ML_USER%:%ML_PASS% ^
    --data-binary "@%%~fF"

  IF ERRORLEVEL 1 (
    ECHO Failed to load %%~nxF
    EXIT /B 1
  )
)

ECHO.
ECHO Load complete.
ENDLOCAL
PAUSE
