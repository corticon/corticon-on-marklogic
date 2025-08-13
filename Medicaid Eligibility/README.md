# Corticon on MarkLogic: Medicaid Eligibility Demo

This project demonstrates a powerful, modern architecture for automating Medicaid eligibility decisions using **Corticon.js** and **MarkLogic Server**.

The demo showcases an end-to-end flow:

1.  A script generates realistic, randomized household data from a live API (Mockaroo).

2.  The data is loaded into MarkLogic, which automatically triggers a Corticon.js decision service.

3.  The enriched decision output, including detailed logs, is written back to MarkLogic.

4.  A Template Driven Extraction (TDE) view is applied, allowing for immediate, real-time SQL analysis of the decision outcomes.

## A High-Fidelity Simulation

This project provides a high-fidelity simulation of a real-world Medicaid eligibility system, grounded in both realistic business rules and statistically modeled test data.

### **Up-to-Date Business Rules**

The Corticon rulesets in this project are not just examples; they are modeled on current, real-world federal and state-level policies. As of August 2025, the rules accurately reflect:

*   **Federal Poverty Level (FPL) Percentages:** Income eligibility thresholds are based on the latest FPL guidelines.

*   **Official Population Cohorts:** The rules correctly identify and process all major Medicaid and CHIP eligibility groups, such as Pregnant Women, Infants, Adult Expansion, and Parents/Caretakers.

*   **Medicaid Expansion Logic:** The rules account for the different eligibility pathways available in states that have adopted Medicaid expansion.

*   **Federal Minimum Coverage:** The benefits packages assigned to eligible individuals are based on federally mandated minimum coverage requirements.

### **Realistic Test Data**

The `run_test_data_load.bat` script calls a live Mockaroo API endpoint to generate a fresh, randomized set of household data for each run. This data is intelligently structured to simulate a realistic applicant population:

*   **Variable Household Size:** Households are generated with 1 to 6 members to test a variety of family structures.

*   **Realistic Demographics:** The schema generates logical data points, including age-appropriate income levels (children have no income) and gender-specific probabilities for conditions like pregnancy.

*   **Statistically Modeled Scenarios:** The probabilities for various life circumstances are modeled on real-world US population data. For example:

    *   The `enrolledMedicare` flag is far more likely to be true for individuals over 65 or those with a `disabled` status.

    *   The `isRefugee` flag has a low probability of being true, reflecting the actual percentage of refugees within the broader Medicaid population.

This approach ensures that the demo is not just a technical showcase, but a meaningful simulation of the complex challenges that Medicaid agencies face every day.

## Prerequisites

Before starting, ensure you have the following software installed and configured.

*   **MarkLogic 10+**

*   **Java 11+** and **Gradle**

*   **cURL** command-line tool (included with Windows 10/11 and Git Bash)

*   **Flux Command-Line Tool** (see setup instructions below)

### **Setting Up Flux**

Flux is a command-line tool that makes it easy to load data into MarkLogic.

1.  **Download Flux:** Go to the [Flux GitHub Releases page](https://www.google.com/search?q=https://github.com/marklogic-community/flux/releases "null") and download the latest `flux-x.y.z.zip` file.

2.  **Unzip the File:** Unzip the downloaded file to a stable location on your computer, for example: `C:\flux\`.

3.  **Configure the Path:** You have two options to make the `flux` command work with the script:

    *   **Option A (Recommended): Add Flux to your System PATH.** This makes the `flux` command available from any command prompt.

        1.  In the Windows search bar, type `env` and select "Edit the system environment variables".

        2.  Click the "Environment Variables..." button.

        3.  Under "System variables", find the `Path` variable, select it, and click "Edit...".

        4.  Click "New" and add the path to the `bin` directory inside your unzipped Flux folder (e.g., `C:\flux\flux-1.3.0\bin`).

        5.  Click OK on all windows. You may need to restart your command prompt for the change to take effect.

    *   **Option B: Edit the Script Directly.** If you prefer not to modify your system PATH, you can edit the `run_test_data_load.bat` script and hardcode the full path to your `flux.bat` executable in the `FLUX_PATH` variable.

## 1\. Configuration

Before you begin, you only need to configure your local MarkLogic connection.

1.  Copy `gradle.properties.example` to `gradle.properties`.

2.  Edit `gradle.properties` and enter your local MarkLogic admin username and password.

## 2\. Deploy the Application

This single command will deploy the databases, roles, users, TDE, and the Corticon trigger to your MarkLogic instance.

```
./gradlew mlDeployApp

```

## 3\. Generate and Load Data

Run the provided batch script. This will automatically call the Mockaroo API to generate 100 new, unique household records and then load them into MarkLogic.

```
./run_test_data_load.bat

```

When the data is loaded, the MarkLogic trigger automatically runs each household through the Corticon decision service, creating the final, enriched documents.

## 4\. Run Sample Queries

You can now use any SQL client (like DBeaver or the MarkLogic Query Console) to connect to the App-Services port (default: 8004) and run queries against the views.

## Sample Query Library

### **Individual & Household Determination Queries**

#### **Full Determination for a Household**

*   **Business Question:** "Give me the complete eligibility picture for everyone in a specific household."

```
-- Replace '...' with a valid householdId from your loaded data.
SELECT
  i.first,
  i.last,
  i.age,
  p.group AS consideredGroup,
  p.incomeIneligible,
  cp.cohort AS finalProgram,
  cp.scopeOfCare
FROM household.individual AS i
LEFT JOIN household.population AS p ON i.individualId = p.individualId
LEFT JOIN household.coverageProgram AS cp ON i.individualId = cp.individualId
WHERE i.householdId = '...';

```

#### **Audit Trail: Explain an Ineligible Decision**

*   **Business Question:** "Why was a specific individual found to be income-ineligible?"

```
-- Replace '...' with a householdId and the individual's name.
SELECT
  m.text AS reason,
  m.ruleSheet,
  m.rule
FROM household.message AS m
WHERE m.householdId = '...'
  AND m.text LIKE '%Firstname Lastname%'
  AND m.text LIKE '%income eligibility requirements%';

```

#### **Full Data Lineage and Provenance**

*   **Business Question:** "For an ineligible individual, show me their original monthly income, the calculated household annual income, the specific income limit for a program they were considered for, and the final decision. I want to see the complete data journey."

```
-- Replace '...' with a valid individualId (e.g., 'householdId-position').
SELECT
  i.first,
  i.last,
  i.monthlyIncome,
  h.annualIncome AS householdAnnualIncome,
  p.group AS consideredForGroup,
  (h.povertyGuideline * p.magiIncomePercent) AS incomeLimitForGroup,
  p.incomeIneligible AS wasIncomeIneligible
FROM household.individual AS i
JOIN household.household AS h ON i.householdId = h.householdId
JOIN household.population AS p ON i.individualId = p.individualId
WHERE i.individualId = '...'
  AND p.incomeIneligible = 1;

```

### **Population & Policy Analysis Queries**

#### **Enrollment by Program and State**

*   **Business Question:** "How many people are enrolled in each final program across all states?"

```
SELECT
  h.state,
  cp.cohort AS program,
  COUNT(DISTINCT cp.individualId) AS numberOfIndividuals
FROM household.household AS h
JOIN household.coverageProgram AS cp ON h.householdId = cp.householdId
WHERE cp.cohort IS NOT NULL
GROUP BY
  h.state,
  cp.cohort
ORDER BY
  h.state,
  numberOfIndividuals DESC;

```

#### **"Near Miss" Households**

*   **Business Question:** "Which households were denied benefits because their income was barely over the limit (e.g., within 10% of the threshold)?"

```
SELECT
  h.householdId,
  h.annualIncome,
  p.group AS consideredGroup,
  (h.povertyGuideline * p.magiIncomePercent) AS incomeLimit,
  (h.annualIncome / (h.povertyGuideline * p.magiIncomePercent)) AS percentOfLimit
FROM household.household AS h
JOIN household.population AS p ON h.householdId = p.householdId
WHERE p.incomeIneligible = 1
  -- Check if income is between 100% and 110% of the calculated limit
  AND (h.annualIncome / (h.povertyGuideline * p.magiIncomePercent)) BETWEEN 1.0 AND 1.10
ORDER BY percentOfLimit;

```

#### **Ineligible Parents by Age Bracket**

*   **Business Question:** "What is the age distribution of parents who were found ineligible?"

```
SELECT
  IneligibleParents.ageBracket,
  COUNT(IneligibleParents.individualId) AS numberOfIneligibleIndividuals
FROM (
  SELECT
    CASE
      WHEN i.age BETWEEN 18 AND 25 THEN '18-25'
      WHEN i.age BETWEEN 26 AND 40 THEN '26-40'
      WHEN i.age BETWEEN 41 AND 55 THEN '41-55'
      ELSE '56+'
    END AS ageBracket,
    i.individualId
  FROM household.individual AS i
  JOIN household.population AS p ON i.individualId = p.individualId
  WHERE
    p."group" = 'Parents and Caretaker Relatives' AND p.incomeIneligible = 1
) AS IneligibleParents
GROUP BY
  IneligibleParents.ageBracket
ORDER BY
  IneligibleParents.ageBracket;

```

### **"What-If" & Advanced Analytics Queries**

#### **Simulating a Policy Change**

*   **Business Question:** "We are considering increasing the income limit for the 'Higher-Income Children (CHIP)' program to 3.0 times the poverty guideline. How many children who were previously denied for this reason would now become eligible?"

```
SELECT
  h.state,
  COUNT(DISTINCT p.individualId) AS newlyEligibleChildren
FROM household.household AS h
JOIN household.population AS p ON h.householdId = p.householdId
WHERE
  p."group" = 'Higher-Income Children (CHIP)'
  AND p.incomeIneligible = 1 -- They were previously ineligible
  -- Check if their income would be UNDER the NEW proposed limit
  AND (h.annualIncome / h.povertyGuideline) < 3.0
GROUP BY h.state;

```

#### **Geographic Impact Analysis**

*   **Business Question:** "Take an ineligible household from one state. If this exact same household lived in other states, where would they have been eligible?"

```
-- Replace '...' with a householdId and update the size to match.
SELECT
  tc.first,
  tc.last,
  sg.state AS simulatedState,
  tc.annualIncome,
  (sg.povertyGuideline * tc.magiIncomePercent) AS simulatedIncomeLimit,
  CASE
    WHEN tc.annualIncome < (sg.povertyGuideline * tc.magiIncomePercent) THEN 'ELIGIBLE'
    ELSE 'INELIGIBLE'
  END AS simulatedEligibilityStatus
FROM
  (
    SELECT
      h.householdId, h.annualIncome, h.size,
      p.magiIncomePercent, i.first, i.last
    FROM household.household AS h
    JOIN household.individual AS i ON h.householdId = i.householdId
    JOIN household.population AS p ON i.individualId = p.individualId
    WHERE h.householdId = '...'
      AND p."group" = 'Parents and Caretaker Relatives'
  ) AS tc
CROSS JOIN
  (
    SELECT DISTINCT state, povertyGuideline
    FROM household.household
    WHERE size = 3 -- Match the size of the test case household
  ) AS sg
WHERE
  'INELIGIBLE' <> (
    CASE
      WHEN tc.annualIncome < (sg.povertyGuideline * tc.magiIncomePercent) THEN 'ELIGIBLE'
      ELSE 'INELIGIBLE'
    END
  )
ORDER BY simulatedIncomeLimit DESC;

```

### **Operational & Data Quality Queries**

#### **Identifying Data Quality Anomalies**

*   **Business Question:** "Do we have any potential data entry errors, such as individuals outside the typical age range listed as a 'Parent or Caretaker'?"

```
SELECT
  i.householdId,
  i.individualId,
  i.first,
  i.last,
  i.age,
  i.isParentOrCaretaker
FROM household.individual AS i
WHERE
  i.isParentOrCaretaker = 1
  AND (i.age < 15 OR i.age > 70);

```

#### **Analyzing Rule Engine Performance**

*   **Business Question:** "Which are the most complex decisions? Show me the households that triggered the highest number of rule executions."

```
SELECT
  m.householdId,
  COUNT(*) AS totalRuleActions
FROM household.metric AS m
GROUP BY
  m.householdId
ORDER BY
  totalRuleActions DESC
LIMIT 10;

```

#### **Most Frequently Executed Rules**

*   **Business Question:** "Which are the most common rules being executed by the system to determine income ineligibility?"

```
SELECT
  m.rulesheetName,
  m.ruleNumber,
  COUNT(*) AS executionCount
FROM household.metric AS m
WHERE m.attributeName = 'incomeIneligible'
GROUP BY
  m.rulesheetName,
  m.ruleNumber
ORDER BY
  executionCount DESC
LIMIT 15;

```