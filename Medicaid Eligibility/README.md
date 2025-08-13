# Corticon on MarkLogic: Medicaid Eligibility Demo

This project demonstrates a powerful, modern architecture for automating Medicaid eligibility decisions using **Corticon.js** and **MarkLogic Server**.

The demo showcases an end-to-end flow:

1.  A script generates realistic, randomized household data from a live API (Mockaroo).

2.  The data is loaded into MarkLogic, which automatically triggers a Corticon.js decision service.

3.  The enriched decision output, including detailed logs, is written back to MarkLogic.

4.  A Template Driven Extraction (TDE) view is applied, allowing for immediate, real-time SQL analysis of the decision outcomes.

---

## Prerequisites

Before starting, ensure you have the following software installed and configured.

*   **MarkLogic 10+**

*   **Java 11+** and **Gradle**

*   **cURL** command-line tool (included with Windows 10/11 and Git Bash)

*   **Flux Command-Line Tool** (see setup instructions below)

### **Setting Up Flux**

Flux is a command-line tool that makes it easy to load data into MarkLogic.

1.  **Download Flux:** Go to the [Flux GitHub Releases page](https://www.google.com/search?q=https://github.com/marklogic-community/flux/releases) and download the latest `flux-x.y.z.zip` file.

2.  **Unzip the File:** Unzip the downloaded file to a stable location on your computer, for example: `C:\flux\`.

3.  **Configure the Path:** You have two options to make the `flux` command work with the script:

    *   **Option A (Recommended): Add Flux to your System PATH.** This makes the `flux` command available from any command prompt.

        1.  In the Windows search bar, type `env` and select "Edit the system environment variables".

        2.  Click the "Environment Variables..." button.

        3.  Under "System variables", find the `Path` variable, select it, and click "Edit...".

        4.  Click "New" and add the path to the `bin` directory inside your unzipped Flux folder (e.g., `C:\flux\flux-1.3.0\bin`).

        5.  Click OK on all windows. You may need to restart your command prompt for the change to take effect.

    *   **Option B: Edit the Script Directly.** If you prefer not to modify your system PATH, you can edit the `run_test_data_load.bat` script and hardcode the full path to your `flux.bat` executable in the `FLUX_PATH` variable.

---

## 1\. Configuration

Before you begin, you only need to configure your local MarkLogic connection.

1.  Copy `gradle.properties.example` to `gradle.properties`.

2.  Edit `gradle.properties` and enter your local MarkLogic admin username and password.

## 2\. Deploy the Application

This single command will deploy the databases, roles, users, TDE, and the Corticon trigger to your MarkLogic instance.

```bash
./gradlew mlDeployApp
```

## 3\. Generate and Load Data

Run the provided batch script. This will automatically call the Mockaroo API to generate 100 new, unique household records and then load them into MarkLogic.

```bash
./run_test_data_load.bat
```
When the data is loaded, the MarkLogic trigger automatically runs each household through the Corticon decision service, creating the final, enriched documents.

## 4\. Run Sample Queries

You can now use any SQL client (like DBeaver or the MarkLogic Query Console) to connect to the App-Services port (default: 8004) and run queries against the views.

#### **Full Determination for a Household**

*(Replace '...' with a valid householdId from your loaded data.)*

```sql
SELECT
  i.first, i.last, i.age,
  p.group AS consideredGroup, p.incomeIneligible,
  cp.cohort AS finalProgram
FROM household.individual AS i
LEFT JOIN household.population AS p ON i.individualId = p.individualId
LEFT JOIN household.coverageProgram AS cp ON i.individualId = p.individualId
WHERE i.householdId = '...';
```

## About the Test Data

The `run_test_data_load.bat` script calls a live Mockaroo API endpoint to generate a fresh, randomized set of household data for each run. This ensures a dynamic and realistic demonstration.

The data model is designed to simulate a real-world Medicaid population:

*   **Variable Household Size:** Households are generated with 1 to 6 members.

*   **Realistic Demographics:** The schema generates logical data points, including age-appropriate income levels (children have no income) and gender-specific probabilities for conditions like pregnancy.

*   **Diverse Scenarios:** A wide range of boolean flags (`disabled`, `enrolledMedicare`, `formerFosterCare`, etc.) are randomly generated to create a rich variety of test cases for the Corticon rules to evaluate.