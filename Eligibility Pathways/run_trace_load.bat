@ECHO OFF
SETLOCAL ENABLEDELAYEDEXPANSION

SET "ML_HOST=localhost"
SET "ML_PORT=8004"
SET "ML_USER=corticonml-admin"
SET "ML_PASS=corticonml-admin"
SET "COLLECTION=http://example.com/data/eligibility-trace"

SET "ROOT_DIR=%CD%"
SET "DATA_DIR=%ROOT_DIR%\data"
SET "TRACE_CSV=%DATA_DIR%\trace data.csv"
SET "TRACE_JSON=%DATA_DIR%\trace-data.json"
SET "CONVERTER=%ROOT_DIR%\scripts\convert_trace_csv.py"

IF NOT EXIST "%DATA_DIR%" (
  ECHO Data folder not found: "%DATA_DIR%"
  EXIT /B 1
)

IF NOT EXIST "%TRACE_CSV%" (
  ECHO Trace CSV not found: "%TRACE_CSV%"
  EXIT /B 1
)

IF NOT EXIST "%CONVERTER%" (
  ECHO Converter script not found: "%CONVERTER%"
  EXIT /B 1
)

WHERE python >NUL 2>&1
IF %ERRORLEVEL% NEQ 0 (
  ECHO python not found. Please install Python 3 to convert the trace CSV.
  EXIT /B 1
)

ECHO Converting trace CSV to JSON...
python "%CONVERTER%" "%TRACE_CSV%" "%TRACE_JSON%"
IF %ERRORLEVEL% NEQ 0 (
  ECHO Trace conversion failed.
  EXIT /B 1
)

WHERE curl >NUL 2>&1
IF %ERRORLEVEL% NEQ 0 (
  ECHO curl not found. Please install curl or use a manual PUT.
  EXIT /B 1
)

SET "URI=/data/eligibility-trace/trace.json"

ECHO Loading %TRACE_JSON% as %URI%
curl --location --request PUT "http://%ML_HOST%:%ML_PORT%/v1/documents?uri=%URI%&perm:corticonml-reader=read&perm:corticonml-writer=update&collection=%COLLECTION%" ^
  --header "Content-Type: application/json" ^
  --digest --user %ML_USER%:%ML_PASS% ^
  --data-binary "@%TRACE_JSON%"

IF ERRORLEVEL 1 (
  ECHO Failed to load trace data.
  EXIT /B 1
)

ECHO.
ECHO Trace load complete.
ENDLOCAL
PAUSE
