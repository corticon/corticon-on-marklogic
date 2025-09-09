@ECHO OFF
ECHO =================================================================
ECHO Step 1: Generating 50 new auto insurance application records from Mockaroo...
ECHO =================================================================

REM Define the output file path
SET OUTPUT_FILE="C:\Users\smeldon\Projects\mlCorticonAutoInsurance\data\mockaroo_auto_output.json"

REM Define the Mockaroo API endpoint with a parameter for 50 rows
SET MOCKAROO_URL="https://my.api.mockaroo.com/car_insurance_application.json?key=33ac6ab0&count=50"

REM Use curl to call the API and save the response to the output file
curl -s -o %OUTPUT_FILE% %MOCKAROO_URL%

ECHO.
ECHO Test data successfully generated and saved to:
ECHO %OUTPUT_FILE%
ECHO.
ECHO =================================================================
ECHO Step 2: Ingesting the new auto insurance application data into MarkLogic (INPUT collection)...
ECHO =================================================================

REM Run the flux command to import the newly created JSON file(s)
"C:\Users\smeldon\Projects\flux test\marklogic-flux-1.3.0\bin\flux" import-aggregate-json-files ^
  --path "C:\Users\smeldon\Projects\mlCorticonAutoInsurance\data\*.json" ^
  --connection-string "corticonml-admin:corticonml-admin@localhost:8004" ^
  --permissions corticonml-reader,read,corticonml-writer,update ^
  --collections http://example.com/data/policy-input ^
  --uri-template "/data/policy-input/{applicationId}.json"

ECHO.
ECHO =================================================================
ECHO Process Complete. Enriched docs will appear in collection: http://example.com/data/policy
ECHO =================================================================

REM Keep the window open
&& pause
