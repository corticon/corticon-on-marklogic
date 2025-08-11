# corticon-on-marklogic

This project demonstrates how to run [Corticon.js](https://www.progress.com/corticon) decision services directly inside a [MarkLogic](https://www.marklogic.com/) database using [ml-gradle](https://github.com/marklogic-community/ml-gradle) for deployment and environment management.

It includes preconfigured roles, users, triggers, and modules for integrating Corticon.js rule execution into a MarkLogic-based data pipeline.

-----

## 🎯 Project Use Case

This project automates Medicaid eligibility determinations using a Corticon.js decision service. The process is as follows:

1.  An initial batch of 50 household records is loaded into the MarkLogic database using a Flux script.
2.  For each document created, a MarkLogic trigger automatically invokes the Corticon.js decision service.
3.  The decision service runs a ruleflow named `Eligibility2025` that includes rulesheets for calculating federal poverty guidelines, setting up eligibility pathways based on state, and associating each individual within a household with an appropriate population group (e.g., "Pregnant Individuals", "Older Children", "Adult Expansion").
4.  The original documents are enriched with the eligibility determination output. This includes calculated values such as age, annual income, poverty guidelines, and the recommended eligibility population for each individual.
5.  A Template-Driven Extraction (TDE) configuration is deployed to allow for ad-hoc SQL queries on the enriched documents within MarkLogic's Query Console.

-----

## 🧰 Prerequisites

  * Java 11+
  * Gradle 6.0+
  * A running MarkLogic instance (locally or remotely)
  * [Corticon.js Studio](https://www.progress.com/corticon) to generate `decisionServiceBundle.js` (Optional)

-----

## ⚙️ Configuration

Before deploying, set the following properties in `gradle.properties`:

```properties
mlHost=localhost
mlUsername=admin
mlPassword=password
mlRestPort=8004
```

🔐 **Important**: Update `mlUsername` and `mlPassword` to match your MarkLogic admin account or environment-specific credentials. The provided `flux.bat` script also uses these credentials, so ensure they are consistent.

-----

## 🚀 Deploying the Project

From the project root, run the following command to deploy the application to your MarkLogic instance:

```bash
gradle mlDeploy
```

This command will automatically perform the following actions:

  * Create the content, schemas, and triggers databases.
  * Configure the REST server on port 8004.
  * Deploy security roles and users, including `corticonml-admin`, `corticonml-writer`, `corticonml-reader`, and `corticonml-nobody`.
  * Deploy Corticon.js modules to MarkLogic.
  * Register a trigger named `corticonTrigger` that executes automatically when new documents are created in the `http://example.com/data/household` collection.

To undeploy everything:

```bash
gradle mlUndeploy
```

-----

## ✅ Uploading Documents (Trigger Execution Test)

After deploying, you can test the functionality by uploading a sample document. The provided `flux.bat` script is configured to import a sample `households.json` file. You must first edit the script to provide the correct paths.

### 📝 Edit the `flux.bat` script

Update the placeholder paths in `flux.bat` to match your local environment:

  * `{insert path to marklogic-flux-1.3.0\bin\flux}`: Replace with the absolute path to your `flux.bat` executable.
  * `{insert path to data\households.json}`: Replace with the absolute path to the `households.json` file in your project directory.

The updated command should look similar to this:

```bat
"C:\marklogic-flux-1.3.0\bin\flux" import-aggregate-json-files --path "C:\path\to\your\project\data\households.json" --connection-string "corticonml-admin:corticonml-admin@localhost:8004" --permissions corticonml-reader,read,corticonml-writer,update --collections http://example.com/data/household --uri-template "/data/household/{householdId}.json" & pause
```

### 🚀 Run the `flux.bat` script

Executing this script will import the sample household data, and the `corticonTrigger` will automatically run the Corticon.js decision service on each document.

-----

## MarkLogic Template Driven Extraction (TDE) for Household Eligibility Data

This TDE template enables SQL queries on household eligibility data processed by Corticon rules engines. The template extracts data from JSON documents containing:

- Household demographic information
- Individual member details and eligibility statuses
- Population group evaluations and income thresholds
- Rule execution messages and decision audit trails

### Data Structure

The source JSON documents follow this structure:
```json
{
  "payload": {
    "householdId": "string",
    "state": "string", 
    "size": integer,
    "annualIncome": decimal,
    "povertyGuideline": decimal,
    "householdPercentFPL": decimal,
    "individual": [
      {
        "ssn": "string",
        "first": "string",
        "last": "string",
        "age": integer,
        "highestFavorable": "string",
        "population": [
          {
            "group": "string",
            "incomeIneligible": boolean,
            "favorability": integer
          }
        ]
      }
    ]
  },
  "corticon": {
    "messages": {
      "message": [
        {
          "severity": "string",
          "text": "string",
          "ruleSheet": "string",
          "rule": "string"
        }
      ]
    }
  }
}
```

### TDE Template

[The TDE template](src/main/ml-schemas/tde/corticon.tde) creates four relational views:

### 1. Household View (`household`)
Extracts household-level information:
- householdId, state, size
- annualIncome, povertyGuideline, householdPercentFPL
- uri (document URI for linking)

### 2. Individual View (`household.individual`) 
Extracts individual member information:
- Personal details (ssn, first, last, age)
- Eligibility flags (disabled, pregnant, usCitizen, etc.)
- Final eligibility determination (highestFavorable)
- householdId for joining to household data

### 3. Population View (`household.population`)
Extracts eligibility group evaluations:
- group (eligibility category evaluated)
- incomeIneligible (whether income disqualified)
- favorability (ranking of eligibility path)
- individual_ssn for joining to individual data

### 4. Messages View (`household.Messages`)
Extracts rule execution logs:
- severity, text (rule message content)
- ruleSheet, rule (specific rule identification)
- uri for linking to source document

### Sample SQL Queries

#### Population Analysis

_Count of Eligible Individuals by State and Program_: Counts approved individuals by health program and state
```sql
SELECT
  h.state,
  i.highestFavorable AS program,
  COUNT(i.ssn) AS numberOfIndividuals
FROM household.household AS h
JOIN household.individual AS i ON h.householdId = i.householdId
WHERE i.highestFavorable IS NOT NULL
GROUP BY
  h.state,
  i.highestFavorable
ORDER BY
  h.state,
  numberOfIndividuals DESC;
```
*Average Household Income by Program*: Calculates income statistics by program
```sql
SELECT
  i.highestFavorable AS program,
  AVG(CAST(h.annualIncome AS DECIMAL(18, 2))) AS averageAnnualIncome
FROM household.household AS h
JOIN household.individual AS i ON h.householdId = i.householdId
WHERE i.highestFavorable IS NOT NULL
GROUP BY
  i.highestFavorable
ORDER BY
  averageAnnualIncome DESC;
```
#### Demographic Analysis

*Age Demographics of Ineligible Parents/Caretakers*: Shows age distribution of income-ineligible parent/caretaker applicants
```sql
SELECT
  IneligibleParents.ageBracket,
  COUNT(IneligibleParents.ssn) AS numberOfIneligibleIndividuals
FROM (
  SELECT
    CASE
      WHEN i.age BETWEEN 18 AND 25 THEN '18-25'
      WHEN i.age BETWEEN 26 AND 40 THEN '26-40'
      WHEN i.age BETWEEN 41 AND 55 THEN '41-55'
      ELSE '56+'
    END AS ageBracket,
    i.ssn
  FROM household.individual AS i
  JOIN household.population AS p ON i.ssn = p.individual_ssn
  WHERE
    p."group" = 'Parents and Caretaker Relatives' AND p.incomeIneligible = 1
) AS IneligibleParents
GROUP BY
  IneligibleParents.ageBracket
ORDER BY
  IneligibleParents.ageBracket;
```

#### Policy Impact Analysis

*States with Highest Potential Coverage Expansion*: - Find "Near Miss" Households (Potential Expansion Group): Identifies states with most potential coverage expansion
```sql
SELECT
  IneligibleParents.ageBracket,
  COUNT(IneligibleParents.ssn) AS numberOfIneligibleIndividuals
FROM (
  SELECT
    CASE
      WHEN i.age BETWEEN 18 AND 25 THEN '18-25'
      WHEN i.age BETWEEN 26 AND 40 THEN '26-40'
      WHEN i.age BETWEEN 41 AND 55 THEN '41-55'
      ELSE '56+'
    END AS ageBracket,
    i.ssn
  FROM household.individual AS i
  JOIN household.population AS p ON i.ssn = p.individual_ssn
  WHERE
    p."group" = 'Parents and Caretaker Relatives' AND p.incomeIneligible = 1
) AS IneligibleParents
GROUP BY
  IneligibleParents.ageBracket
ORDER BY
  IneligibleParents.ageBracket;
```

```sql
SELECT
  h.state,
  COUNT(DISTINCT h.householdId) AS potentialNewHouseholds
FROM household.household AS h
JOIN household.individual AS i
  ON h.householdId = i.householdId
JOIN household.population AS p
  ON i.ssn = p.individual_ssn
WHERE
  -- Focus on specific eligibility group
  p."group" = 'Parents and Caretaker Relatives'
  AND p.incomeIneligible = 1
  -- Only households with no current eligibility
  AND h.householdId NOT IN (
    SELECT householdId
    FROM household.individual
    WHERE highestFavorable IS NOT NULL
  )
  -- Income over current limit but under 25% higher limit
  AND CAST(h.annualIncome AS DECIMAL(18, 2)) > (
    CAST(h.povertyGuideline AS DECIMAL(18, 2)) * CAST(p.magiIncomePercent AS DECIMAL(18, 2))
  )
  AND CAST(h.annualIncome AS DECIMAL(18, 2)) <= (
    CAST(h.povertyGuideline AS DECIMAL(18, 2)) * CAST(p.magiIncomePercent AS DECIMAL(18, 2)) * 1.25
  )
GROUP BY
  h.state
ORDER BY
  potentialNewHouseholds DESC;
```

#### Individual Case & Data Quality Analysis

*Full Eligibility Picture for a Household*: Case file summary showing all programs considered per family member
```sql
SELECT
  i.first,
  i.last,
  i.age,
  i.highestFavorable,
  p."group" AS consideredGroup,
  p.incomeIneligible
FROM household.individual AS i
LEFT JOIN household.population AS p ON i.ssn = p.individual_ssn
WHERE i.householdId = '353021'  -- Replace with target household
ORDER BY
  i.first,
  p.favorability DESC;
```

*Mismatched Age/Program Evaluations*: Data quality check for logical errors in program assignments
```sql
SELECT
  i.householdId,
  i.first,
  i.last,
  i.age,
  p."group" AS mismatchedGroup
FROM household.individual AS i
JOIN household.population AS p ON i.ssn = p.individual_ssn
WHERE
  (p."group" = 'Infants (0-1)' AND i.age > 1) OR
  (p."group" = 'Young Children (Ages 1-5)' AND (i.age < 1 OR i.age > 5)) OR
  (p."group" = 'Older Children (Ages 6-18)' AND (i.age < 6 OR i.age > 18))
ORDER BY
  i.householdId;
```
#### Rule & Decision Tracing

*Most Frequent Rule Executions*: Top 10 Most Frequent "Determination" Rules: Ranks most impactful eligibility determination rules
```sql
SELECT TOP 10
  m.rule,
  m.ruleSheet,
  COUNT(*) AS executionCount
FROM household.Messages AS m
WHERE
  m.ruleSheet = 'Determination'
GROUP BY
  m.rule,
  m.ruleSheet
ORDER BY
  executionCount DESC;
```
*Rule Tracing for Individual Decisions*: Pinpoint the Exact Rule That Made a Person Income-Ineligible: Traces specific rule messages explaining denials
```sql
SELECT
  i.first,
  i.last,
  p."group" AS consideredGroup,
  m.text AS reason,
  m.ruleSheet,
  m.rule
FROM household.individual AS i
JOIN household.population AS p ON i.ssn = p.individual_ssn
JOIN household.Messages AS m ON i.uri = m.uri
WHERE i.first = 'Etienne' AND i.last = 'Arnow'  -- Replace with target individual
  AND p.incomeIneligible = 'true'
  AND m.text LIKE '%income eligibility requirements%';
```


## Documentation References
- [MarkLogic TDE Documentation](https://docs.marklogic.com/guide/app-dev/TDE)
- [SQL on MarkLogic Guide](https://docs.marklogic.com/guide/sql)
- [Template Driven Extraction Tutorial](https://developer.marklogic.com/learn/template-driven-extraction/)