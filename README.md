
corticon-on-marklogic
=====================

This project demonstrates how to run [Corticon.js](https://docs.progress.com/category/corticon-javascript) decision services directly inside a [MarkLogic](https://www.marklogic.com/) database using [ml-gradle](https://github.com/marklogic-community/ml-gradle) for deployment and environment management.

It includes preconfigured roles, users, triggers, and modules for integrating Corticon.js rule execution into a MarkLogic-based data pipeline.

* * *

🧰 Prerequisites
----------------

*   Java 11+
*   Gradle 6.0+
*   A running MarkLogic instance (locally or remotely)
*   [Corticon.js Studio](https://www.progress.com/campaigns/corticon/corticon-request-trial) to generate `decisionServiceBundle.js` (Optional)

* * *

⚙️ Configuration
----------------

Before deploying, set the following properties in `gradle.properties`:

    mlHost=localhost
    mlUsername=admin
    mlPassword=password
    mlRestPort=8004
    

🔐 **Important**: Update `mlUsername` and `mlPassword` to match your MarkLogic admin account or environment-specific credentials. The provided `flux.bat` script also uses these credentials, so ensure they are consistent.

* * *

🚀 Deploying the Project
------------------------

From the project root, run the following command to deploy the application to your MarkLogic instance:

    gradle mlDeploy
    

This command will automatically perform the following actions:

*   Create the content, schemas, and triggers databases.
*   Configure the REST server on port 8004.
*   Deploy security roles and users, including `corticonml-admin`, `corticonml-writer`, `corticonml-reader`, and `corticonml-nobody`.
*   Deploy Corticon.js modules to MarkLogic.
*   Register a trigger named `corticonTrigger` that executes automatically when new documents are created in the `http://example.com/data/household` collection.

To undeploy everything:

    gradle mlUndeploy
    

* * *

✅ Uploading Documents (Trigger Execution Test)
----------------------------------------------

After deploying, you can test the functionality by uploading a sample document. The provided `flux.bat` script is configured to import a sample `households.json` file. You must first edit the script to provide the correct paths.

### 📝 Edit the `flux.bat` script

Update the placeholder paths in `flux.bat` to match your local environment:

*   `{insert path to marklogic-flux-1.3.0\bin\flux}`: Replace with the absolute path to your `flux.bat` executable.
*   `{insert path to data\households.json}`: Replace with the absolute path to the `households.json` file in your project directory.

The updated command should look similar to this:

    "C:\marklogic-flux-1.3.0\bin\flux" import-aggregate-json-files --path "C:\path\to\your\project\data\households.json" --connection-string "corticonml-admin:corticonml-admin@localhost:8004" --permissions corticonml-reader,read,corticonml-writer,update --collections http://example.com/data/household --uri-template "/data/household/{householdId}.json" & pause
    

### 🚀 Run the `flux.bat` script

Executing this script will import the sample household data, and the `corticonTrigger` will automatically run the Corticon.js decision service on each document.

* * *

🗂️ Project Structure and Key Components
----------------------------------------

    src/main/
    ├── ml-config/         # App server, database, user, role, trigger configuration
    │   └── triggers/      # corticonTrigger.json
    │   └── security/      # roles/ and users/
    │   └── databases/     # content/triggers/schemas DBs
    │   └── rest-api.json
    ├── ml-modules/
    │   └── ext/           # Corticon.js modules and integration logic
    │   └── options/       # Search options (e.g., corticonml-options.xml)
    ├── ml-schemas/
    │   └── tde/           # Template-driven extraction (e.g., corticon.tde)
    

**Key components in this project:**

*   **`decisionServiceBundle.js`**: The generated file from Corticon.js Studio that contains the executable rules.
*   **`marklogic.trigger.sample.sjs`**: A server-side JavaScript module that defines the trigger logic to call the Corticon decision service.
*   **`corticonTrigger.json`**: The configuration file for the trigger that links the `marklogic.trigger.sample.sjs` module to the `http://example.com/data/household` collection. It specifies that the trigger should run on `pre-commit` updates to document content.
*   **`corticon.tde`**: A Template Driven Extraction file that defines how to extract data from the enriched documents into a relational view for SQL queries.
*   **`gradle.properties`**: Defines variables used during deployment, such as the MarkLogic host, port, username, and password.