# Trade Data Settlement with Corticon.js and MarkLogic

This project demonstrates how to run a **Corticon.js** decision service directly inside a **MarkLogic** database to perform real-time data validation and enrichment. It provides a foundational example of how to integrate Corticon.js into a MarkLogic-based data pipeline for any scenario that requires rules-based processing as data is ingested.

---

## The Business Requirement: Real-Time Data Validation and Enrichment

In many data-driven workflows, particularly in financial services, it is critical to validate and enrich data as it arrives. For example, when a trade settlement record is received, it may need to be checked against a series of business rules to determine if it is valid, to calculate settlement dates, or to assign risk scores.

Doing this in a separate application can introduce latency and create a more complex, brittle architecture. This project demonstrates a more streamlined approach by embedding the decision-making logic directly within the data layer. This provides:

*   **Real-Time Processing:** Rules are executed as part of the data ingestion transaction, ensuring that data is validated and enriched the moment it arrives.
*   **Simplified Architecture:** By co-locating the decision logic with the data, you eliminate the need for a separate rules execution server and reduce the number of moving parts in your system.
*   **Improved Data Governance:** Business rules are applied consistently to all incoming data, ensuring a higher level of data quality and compliance.

---

## How it Works

The project is designed to showcase a simple, yet powerful, data processing workflow:

1.  **Deployment:** The `ml-gradle` scripts deploy all the necessary components to MarkLogic, including databases, users, roles, and a trigger.
2.  **Data Ingestion:** A new JSON document representing a trade is ingested into a specific collection in the MarkLogic database.
3.  **Trigger Execution:** The ingestion of the document automatically triggers a Server-Side JavaScript (SJS) module.
4.  **Decision Service Execution:** The SJS module calls the `decisionServiceBundle.js`, which is a pre-compiled Corticon.js decision service. The decision service evaluates the trade data against a set of business rules.
5.  **Data Enrichment:** The decision service returns a payload with the results of the evaluation, which is then used to enrich the original JSON document.

---

## 🚀 How to Run This Demo

### Prerequisites

*   **MarkLogic 12+**
*   **Java 11+** and **Gradle**
*   **Corticon.js Studio 2.3 or higher** (to view the rules, or to re-bundle the decision service)
*   A command-line tool capable of making HTTP requests, such as **cURL**.

### 1. Configure Your MarkLogic Connection

Before deploying, you need to set your MarkLogic connection details.

1.  Open the `gradle.properties` file in this directory.
2.  Update the `mlUsername` and `mlPassword` properties to match the credentials for your local MarkLogic admin account.

```properties
# gradle.properties
mlHost=localhost
mlUsername=admin
mlPassword=your-admin-password
mlRestPort=8004
```

### 2. Deploy the Project

From this directory, run the following command:

```bash
gradle mlDeploy
```

This will deploy all the necessary databases, application servers, roles, users, and the trigger to your MarkLogic instance.

To remove the deployed components later, you can run:

```bash
gradle mlUndeploy
```

### 3. Trigger the Decision Service

After deploying the app, you can trigger the decision service by uploading a document into the `http://example.com/data/ledger` collection.

Here is an example using `curl`. This command inserts a new trade document, which causes the trigger to fire and execute the Corticon.js rules.

```bash
curl --location --request PUT 'http://localhost:8004/v1/documents?uri=/data/ledgerDemo/CASE01-SETTLED.json&perm:corticonml-reader=read&perm:corticonml-writer=update&collection=http://example.com/data/ledger' \
--header 'Content-Type: application/json' \
--digest --user corticonml-admin:corticonml-admin \
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

If the request is successful, you can then view the document in MarkLogic (e.g., through the Query Console) and see that it has been enriched with the output from the decision service.
