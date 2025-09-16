# Trade Data Settlement with Corticon.js and MarkLogic

This project demonstrates how to run **Corticon.js** decision services directly inside a **MarkLogic** database using **ml-gradle** for deployment and environment management. It provides a foundational example of how to integrate Corticon.js for real-time data enrichment and validation within a MarkLogic-based data pipeline.

---

## How it Works

The project is designed to showcase a simple, yet powerful, data processing workflow:

1.  **Deployment:** The `ml-gradle` scripts deploy all the necessary components to MarkLogic, including databases, users, roles, and a trigger.
2.  **Data Ingestion:** A new JSON document representing a trade is ingested into a specific collection in the MarkLogic database.
3.  **Trigger Execution:** The ingestion of the document automatically triggers a Server-Side JavaScript (SJS) module.
4.  **Decision Service Execution:** The SJS module calls the `decisionServiceBundle.js`, which is a pre-compiled Corticon.js decision service. The decision service evaluates the trade data against a set of business rules.
5.  **Data Enrichment:** The decision service returns a payload with the results of the evaluation, which is then used to enrich the original JSON document.

---

## 🧰 Prerequisites

- Java 11+
- Gradle 6.0+
- A running MarkLogic instance (locally or remotely)
- Optional: [Corticon.js Studio](https://www.progress.com/corticon) to generate `decisionServiceBundle.js`

---

## ⚙️ Configuration

Before deploying, set the following properties in `gradle.properties`:
```
mlHost=localhost
mlUsername=admin
mlPassword=admin
```
🔐 Change mlUsername and mlPassword to match your MarkLogic admin account or environment-specific credentials.

---

## 🚀 Deploy the Project

From the project root, run:
```bash
gradle mlDeploy
```
This will:

*   Create the content, schemas, and triggers databases
*   Configure the REST server
*   Deploy security roles and users
*   Deploy Corticon.js modules to MarkLogic
*   Register a trigger to run Corticon on document update
  
To undeploy everything:
```bash
gradle mlUndeploy
```

---

## ✅ Trigger the Decision Service

After deploying the app, you can trigger the decision service by uploading a document into the `http://example.com/data/ledger` collection.

Here is an example using `curl`:

```bash
curl --location --request PUT 'http://localhost:8004/v1/documents?uri=/data/ledgerDemo/CASE01-SETTLED.json&perm:corticonml-reader=read&perm:corticonml-writer=update&collection=http://example.com/data/ledger' \
--header 'Content-Type: application/json' \
--digest --user corticonml-admin:admin \
--data-raw '{ 
    "marketCalendar": { 
        "market": "XETR", 
        "date": "2025-07-22T20:00:00.000-0400", 
        "isBusinessDay": true 
    }, 
    "trade": { 
        "quantity": "1000.000000", 
        "tradeDate": "2025-07-20T20:00:00.000-0400", 
        "assetClass": "Equity", 
        "actualSettlementDate": "2025-07-22T20:00:00.000-0400", 
        "market": "XETR", 
        "agreedSettlementDate": "2025-07-22T20:00:00.000-0400", 
        "netCashAmount": "45500.000000", 
        "counterpartyId": "CPTY-001", 
        "security": { 
            "description": "BASF SE", 
            "isin": "DE000BASF111" 
        }, 
        "settlementCurrency": "EUR", 
        "price": "45.500000", 
        "quantityRemaining": "0.000000", 
        "tradeId": "CASE01-SETTLED", 
        "tradeType": "Buy", 
        "status": "Settled" 
    }, 
    "counterparty": { 
        "counterpartyId": "CPTY-001", 
        "lei": "5493001B3S86FF8BA273", 
        "tier": "Tier 1", 
        "name": "Alpha Trading" 
    } 
}'
```

If the request is successful, the trigger will automatically run the Corticon.js decision service on the document, enriching it with the decision outcome.

---

## 🗂️ Project Structure

```
src/main/
├── ml-config/         # App server, database, user, role, and trigger configurations.
│   └── triggers/      # Contains the definition of the trigger that fires on document ingestion.
│   └── security/      # Defines the roles and users for the application.
│   └── databases/     # Configuration for the content, triggers, and schemas databases.
│   └── rest-api.json  # Configuration for the REST API server.
├── ml-modules/
│   └── ext/           # Contains the Corticon.js modules and integration logic.
│   └── options/       # Search options for the application.
├── ml-schemas/
│   └── tde/           # Template Driven Extraction (TDE) schemas for creating relational views on top of the JSON data.
```

### Key Components:

*   `decisionServiceBundle.js`: This is the Corticon.js decision service, compiled from a Corticon Studio project. It contains all the business rules and logic.
*   `marklogic.trigger.sample.sjs`: This is the Server-Side JavaScript (SJS) module that gets executed by the trigger. It's responsible for calling the decision service and processing the response.
*   `corticonTrigger.json`: This is the configuration file that defines the trigger, including the collection it monitors and the SJS module it executes.