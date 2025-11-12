# MarkLogic Backend for Auto Insurance Demo

This project contains the MarkLogic backend components for the Auto Insurance demonstration. It is responsible for deploying the necessary databases, servers, and triggers to MarkLogic, and for running the Corticon.js decision service to process insurance applications.

---

## Prerequisites

Before starting, ensure you have the following software installed and configured:

*   **MarkLogic 12+**
*   **Java 11+** and **Gradle**

---

## 🚀 How to Deploy the Backend

### 1. Configure Your MarkLogic Connection

Before deploying, you need to set your MarkLogic connection details.

1.  Open the `gradle.properties` file in this directory.
2.  Update the `mlUsername` and `mlPassword` properties to match the credentials for your local MarkLogic admin account.

```properties
# gradle.properties
mlUsername=admin
mlPassword=your-admin-password
```

### 2. Deploy the Application

This single command will deploy the databases, roles, users, TDE templates, and the Corticon trigger to your MarkLogic instance.

Open a terminal in this directory and run:

```bash
gradle mlDeploy
```

### 3. Load Test Data to Trigger Processing

Insert one or more policy JSON documents into the `http://example.com/data/policy-input` collection. The trigger will call the Corticon.js decision service and persist the enriched output under `/data/policy/`.

- Use your own sample that matches the input schema (see `../insurance-chatbot/schema.json`), or start with a minimal payload including an `applicationId`.

Example using `curl` (adjust values as needed):

```bash
curl --location --request PUT 'http://localhost:8004/v1/documents?uri=/data/policy-input/APP-123.json&perm:corticonml-reader=read&perm:corticonml-writer=update&collection=http://example.com/data/policy-input' \
  --header 'Content-Type: application/json' \
  --digest --user corticonml-admin:corticonml-admin \
  --data-raw '{
    "applicationId": "APP-123",
    "state": "CA",
    "drivers": [ { "first": "Alex", "last": "Rivera", "age": 30, "yearLicensed": 2012, "applicationId": "APP-123", "advancedDriverTraining": false, "fullTimeStudent": false, "gpa": 0, "gradeAverage": "" } ],
    "vehicles": [ { "bodyStyle": "Sedan", "applicationId": "APP-123", "coverages": [ { "part": "Liability", "applicationId": "APP-123" } ] } ]
  }'
```

After the PUT completes, look for an enriched document at a URI like `/data/policy/APP-123.json`.
