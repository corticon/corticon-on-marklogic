@ECHO OFF
ECHO =================================================================
ECHO Step 1: Generating 100 new household records from Mockaroo...
ECHO =================================================================

REM This script uses a live API call to generate realistic, randomized test data.
SET OUTPUT_FILE="data\mockaroo_output.json"

REM This URL points to the pre-configured Mockaroo schema for this demo.
SET MOCKAROO_URL="https://my.api.mockaroo.com/complete_mockaroo_schema_for_medicaid_households.json?key=33ac6ab0&count=100"

ECHO Calling Mockaroo API to generate fresh test data...
curl -s -o %OUTPUT_FILE% %MOCKAROO_URL%
ECHO Test data successfully saved to: %OUTPUT_FILE%
ECHO.
ECHO =================================================================
ECHO Step 2: Ingesting the new household data into MarkLogic...
ECHO =================================================================

REM This assumes 'flux.bat' is in the system PATH.
REM Otherwise, edit this line to provide the full path to your flux.bat file.
flux import-aggregate-json-files --path %OUTPUT_FILE% --connection-string "corticonml-admin:corticonml-admin@localhost:8004" --permissions corticonml-reader,read,corticonml-writer,update --collections http://example.com/data/household,corticon-medicaid-response --uri-template "/data/household/{/householdId}.json"

ECHO.
ECHO =================================================================
ECHO Process Complete.
ECHO =================================================================
pause