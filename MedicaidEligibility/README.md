# Corticon on MarkLogic: Medicaid Eligibility Demo

This project demonstrates a powerful, modern architecture for automating Medicaid eligibility decisions using **Corticon.js** and **MarkLogic Server**. It is designed to provide a high-fidelity simulation of a real-world Medicaid eligibility system, grounded in both realistic business rules and statistically modeled test data.

---

## The Business Requirement: Automating Complex Eligibility Determinations

State and federal agencies that administer social benefits programs like Medicaid and CHIP face a significant challenge. The eligibility rules are incredibly complex, constantly changing due to new legislation, and vary from state to state. Manually processing applications is slow, expensive, and can lead to inconsistent or inaccurate determinations, directly impacting people's lives.

This project demonstrates a solution to this problem by:

*   **Modeling Complex Rules:** Using Corticon.js to model the complex web of federal and state eligibility rules in a format that is easy for business analysts to understand and maintain.
*   **Automating Determinations:** Running these rules automatically within MarkLogic as new applicant data is received, ensuring that every application is processed consistently and accurately.
*   **Enabling Data-Driven Policy Analysis:** By capturing the enriched decision outcomes in MarkLogic and exposing them to SQL, the system allows policy analysts to ask sophisticated "what-if" questions and understand the potential impact of rule changes *before* they are implemented.

---

## A High-Fidelity Simulation

This project provides a robust simulation of a real-world Medicaid eligibility system, grounded in both realistic business rules and statistically modeled test data.

### **Up-to-Date Business Rules**

The Corticon rulesets in this project are not just examples; they are modeled on current, real-world federal and state-level policies. As of August 2025, the rules accurately reflect:

*   **Federal Poverty Level (FPL) Percentages:** Income eligibility thresholds are based on the latest FPL guidelines.
*   **Official Population Cohorts:** The rules correctly identify and process all major Medicaid and CHIP eligibility groups, such as Pregnant Women, Infants, Adult Expansion, and Parents/Caretakers.
*   **Medicaid Expansion Logic:** The rules account for the different eligibility pathways available in states that have adopted Medicaid expansion.
*   **Federal Minimum Coverage:** The benefits packages assigned to eligible individuals are based on federally mandated minimum coverage requirements.

### **Realistic Test Data**

The `run_test_data_load.bat` script calls a live Mockaroo API endpoint to generate a fresh, randomized set of household data for each run. This data is intelligently structured to simulate a realistic applicant population, including variable household sizes, realistic demographics, and statistically modeled life circumstances.

This approach ensures that the demo is not just a technical showcase, but a meaningful simulation of the complex challenges that Medicaid agencies face every day.

---

## 🚀 How to Run This Demo

### Prerequisites

Before starting, ensure you have the following software installed and configured:

*   **MarkLogic 12+**
*   **Java 11+** and **Gradle**
*   **cURL** command-line tool (included with Windows 10/11 and Git Bash)

---

## Before You Start

- Ensure MarkLogic 12 is running and you have admin credentials.
- Confirm Gradle is available: `gradle -v`.
- Verify `mlRestPort` in `gradle.properties` (default `8004`).
- Confirm `src/main/ml-modules/ext/medicaidDecisionServiceBundle.js` exists (compiled Corticon service).

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

### 3. Generate and Load Data

Run the provided batch script. This will call the Mockaroo API to generate 100 new, unique household records and then load them into MarkLogic using the MarkLogic Flux CLI.

Note: This step requires the `flux` command to be available on your PATH. If it is not installed, either install MarkLogic Flux or load data via another method (e.g., cURL or Query Console).

```bash
./run_test_data_load.bat
```

When the data is loaded, the MarkLogic trigger automatically runs each household through the Corticon decision service, creating the final, enriched documents.

### 4. Run Sample Queries

You can now use any SQL client (like DBeaver or the MarkLogic Query Console) to connect to the App-Services port (default: 8004) and run queries against the relational views generated by the TDE.

---

## Notable Files

- `src/main/ml-config/triggers/medicaidTrigger.json` — Post-commit trigger for collection `http://example.com/data/medicaid-input` calling `/ext/medicaidTrigger.sjs`.
- `src/main/ml-modules/ext/medicaidTrigger.sjs` — Executes the Corticon decision service, normalizes outputs, and writes to `/data/medicaid/{householdId}.json`.
- `src/main/ml-modules/ext/medicaidDecisionServiceBundle.js` — Compiled Corticon.js rules bundle used by the trigger.
- `src/main/ml-schemas/tde/medicaid-template.tde` — TDE for analytics-friendly views over enriched documents.
- `src/main/ml-modules/rest-properties.json` — REST API properties for the deployed REST server.
- `src/main/ml-modules/options/corticonml-options.xml` — Search options and resource registration (if applicable).
- `src/main/ml-config/security/*` — Roles and users used by the demo.
