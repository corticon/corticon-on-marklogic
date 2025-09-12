@ECHO OFF
ECHO ================================================================
ECHO Step 1: Generating 1 new auto insurance application record from Mockaroo...
ECHO ================================================================

REM Define the output file path and directory
SET OUTPUT_DIR=C:\Users\smeldon\Projects\mlCorticonAutoInsurance\data
SET OUTPUT_FILE=%OUTPUT_DIR%\mockaroo_auto_output.json

REM Create the output directory if it doesn't exist
IF NOT EXIST "%OUTPUT_DIR%" (
    ECHO Creating directory: %OUTPUT_DIR%
    MKDIR "%OUTPUT_DIR%"
)

REM Define the Mockaroo API endpoint for 1 row (escape & with ^)
SET MOCKAROO_URL=https://my.api.mockaroo.com/car_insurance_application.json?key=33ac6ab0

REM Use curl to call the API and save the response to the output file
curl -s -o "%OUTPUT_FILE%" "%MOCKAROO_URL%"

IF NOT EXIST "%OUTPUT_FILE%" (
    ECHO ERROR: Failed to generate Mockaroo output file. File does not exist.
    GOTO END
)

ECHO.
ECHO Test data successfully generated and saved to:
ECHO %OUTPUT_FILE%
ECHO.

ECHO ================================================================
ECHO Step 2: Ingesting the new auto insurance application data into MarkLogic (INPUT collection)...
ECHO ================================================================

REM Run the Flux command to import the newly created JSON file
"C:\Progress\flux\marklogic-flux-1.3.0\bin\flux.bat" import-aggregate-json-files ^
    --path "%OUTPUT_FILE%" ^
    --connection-string "admin:password@localhost:8004" ^
    --database corticonml-content ^
    --permissions corticonml-reader,read,corticonml-writer,update ^
    --collections http://example.com/data/policy-input ^
    --uri-template /data/policy-input/{applicationId}.json

IF ERRORLEVEL 1 (
    ECHO.
    ECHO ERROR: Flux import failed. Check paths and connection parameters.
    GOTO END
)
PAUSE

ECHO.
ECHO ================================================================
ECHO Process Complete. Enriched docs will appear in collection: http://example.com/data/policy-input
ECHO ================================================================

:END
PAUSE