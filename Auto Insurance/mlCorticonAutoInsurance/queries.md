Of course. Based on your TDE, here are several new SQL queries you can use to analyze your insurance policy data, categorized by their purpose.

-----

### 📊 Population & Trend Analysis

These queries provide a high-level view of your data, helping you identify trends across all policies.

#### Discount Frequency and Impact

This query helps you understand which discounts are most valuable by showing how often each is applied and its average value.

```sql
SELECT
    d.category,
    COUNT(*) AS frequency,
    AVG(d.value) AS average_discount_percentage
FROM Discounts d
GROUP BY d.category
ORDER BY frequency DESC;
```

#### Surcharge Analysis by State

This query identifies states where premium surcharges are most common, which could indicate higher-risk geographic areas.

```sql
SELECT
    p.state,
    s.category AS surcharge_type,
    COUNT(s.category) AS frequency
FROM Details p
JOIN Surcharges s ON p.applicationId = s.applicationId
GROUP BY p.state, s.category
ORDER BY p.state, frequency DESC;
```

#### Age and At-Fault Accident Correlation

This query creates age brackets to show the distribution of at-fault accidents among different age groups, helping to validate age-related risk models.

```sql
SELECT
    CASE
        WHEN d.age < 25 THEN 'Under 25'
        WHEN d.age BETWEEN 25 AND 39 THEN '25-39'
        WHEN d.age BETWEEN 40 AND 59 THEN '40-59'
        ELSE '60+'
    END AS age_bracket,
    COUNT(i.incidentType) AS at_fault_accidents
FROM Drivers d
JOIN Incidents i ON d.applicationId = i.applicationId
WHERE i.incidentType = 'At Fault Auto Accident'
GROUP BY age_bracket
ORDER BY age_bracket;
```

-----

### 🕵️ Decision Explanation (Case-by-Case)

These queries are for drilling down into a single policy to understand precisely how and why a decision was reached.

#### Full Premium Breakdown for a Single Policy

This provides a complete financial summary for one policy, showing how the base rates are adjusted by every applicable discount and surcharge to arrive at the final premium.

```sql
-- Replace '01K45ZTHKJK76VHTCR3KKQF3ZS' with a specific applicationId
SELECT
    c.part AS coverage_type,
    c.baseRate,
    d.category AS discount_category,
    d.value AS discount_value,
    s.category AS surcharge_category,
    s.value AS surcharge_value,
    c.premium AS final_premium
FROM Coverages c
LEFT JOIN Discounts d ON c.applicationId = d.applicationId
LEFT JOIN Surcharges s ON c.applicationId = s.applicationId
WHERE c.applicationId = '01K45ZTHKJK76VHTCR3KKQF3ZS';
```

#### Trace a Specific Attribute Change

This query uses the `AttributeChanges` view to show the exact rule that set a specific value, providing a granular audit trail for any calculation.

```sql
-- Find out exactly which rule set the 'isHighTheft' flag for any vehicle in a policy
SELECT
    ac.rulesheetName,
    ac.ruleNumber,
    ac.entityName,
    ac.attributeName,
    ac.afterValue
FROM AttributeChanges ac
WHERE ac.applicationId = '01K3SNRFVV5TQ3Y5KEM5ZP1E5R' AND ac.attributeName = 'isHighTheft';
```

-----

### ✅ Auditing & Validation

These queries help validate that the rules are working as intended by joining the final data with the trace and message data.

#### Verify "Safe Driver" Discount Logic

This query checks for potential logic errors by finding drivers who received a "Safe Driver" discount but still have at-fault incidents on their record. An empty result set indicates the logic is sound.

```sql
SELECT
    d.applicationId,
    d.first,
    d.last,
    disc.category
FROM Drivers d
JOIN Discounts disc ON d.applicationId = disc.applicationId
WHERE disc.category = 'Safe Driver / Incident-Free'
  AND d.applicationId IN (SELECT i.applicationId FROM Incidents i WHERE i.incidentType = 'At Fault Auto Accident');
```

#### Correlate Safety Features to Discounts

This query validates that a specific safety feature correctly resulted in its corresponding discount, which is useful for ensuring complex vehicle-level rules are firing correctly.

```sql
-- Check if vehicles with Standard Forward Collision Warning received the discount
SELECT
    v.applicationId,
    v.make,
    v.model,
    (SELECT COUNT(*) FROM Discounts d WHERE d.applicationId = v.applicationId AND d.category = 'Forward Collision Warning') AS discount_applied_count
FROM Vehicles v
WHERE v.forwardCollisionWarning = 'Standard';
```



<query name="Average Premium by State" focus="false" listorder="2" taborder="1" active="true" database="12599025200041773524" server="13162816383336325459" database-name="corticonml-content" server-name="corticonml" mode="sql" optimize="1">SELECT

    p.state,

    AVG(p.netPremium) AS average_premium,

    COUNT(*) AS policy_count

FROM Details p

GROUP BY p.state

ORDER BY average_premium DESC;</query><query name="Most Common Driver Incidents" focus="false" listorder="3" taborder="3" active="true" database="12599025200041773524" server="13162816383336325459" database-name="corticonml-content" server-name="corticonml" mode="sql" optimize="1">SELECT

    i.incidentType,

    COUNT(*) as total_incidents

FROM Incidents i

GROUP BY i.incidentType

ORDER BY total_incidents DESC;</query><query name="High-Theft Vehic..." focus="false" listorder="4" taborder="4" active="true" database="12599025200041773524" server="13162816383336325459" database-name="corticonml-content" server-name="corticonml" mode="sql" optimize="1">SELECT

    v.make,

    COUNT(*) AS high_theft_vehicle_count

FROM Vehicles v

WHERE v.isHighTheft = 1

GROUP BY v.make

ORDER BY high_theft_vehicle_count DESC;</query><query name="Single Application" focus="false" listorder="5" taborder="5" active="true" database="12599025200041773524" server="13162816383336325459" database-name="corticonml-content" server-name="corticonml" mode="sql" optimize="1">-- Get all drivers and vehicles associated with a specific policy.

-- Replace 'some-app-id' with a real applicationId from your data.


SELECT

  d.first,

  d.last,

  d.age,

  v.make,

  v.model,

  v.modelYear

FROM

  policy.Drivers AS d

JOIN

  policy.Vehicles AS v ON d.applicationId = v.applicationId

WHERE

  d.applicationId = '01K45ZTGQBAN7NDYFR2XSJSVWX';</query><query name="Coverages and Pr..." focus="false" listorder="6" taborder="6" active="true" database="12599025200041773524" server="13162816383336325459" database-name="corticonml-content" server-name="corticonml" mode="sql" optimize="1">SELECT

*

FROM Coverages c

WHERE c.applicationId = '01K45ZTGV1VNHGD7ZATESEXXDB';</query><query name="Why a &quot;Good Student&quot; Discount Was Determined" focus="false" listorder="7" taborder="7" active="true" database="12599025200041773524" server="13162816383336325459" database-name="corticonml-content" server-name="corticonml" mode="sql" optimize="1">SELECT

    d.first,

    d.last,    

    d.gradeAverage,

    d.gpa,

    m.text AS reason

FROM Drivers d

JOIN Messages m ON d.applicationId = m.applicationId

WHERE m.text LIKE '%good student%';</query><query name="Violation to a Specific Driver Incident" focus="true" listorder="8" taborder="8" active="true" database="12599025200041773524" server="13162816383336325459" database-name="corticonml-content" server-name="corticonml" mode="sql" optimize="1">SELECT

    d.first,

    d.last,   

    i.incidentType,

    i.date,

    m.severity,

    m.text AS rule_message

FROM Drivers d

JOIN Incidents i ON d.applicationId = i.applicationId

JOIN Messages m ON d.applicationId = m.applicationId

WHERE m.severity = 'Violation'

  AND i.incidentType = 'OUI Conviction';</query>


these should ideally illustrate population level queries, individual case by case explanations for decisions, and intertwine the rule messages and trace data with the actual output date in the payload object.

