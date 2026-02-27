# Sample SQL Queries

```sql
-- Households by state
SELECT state, COUNT(*) AS household_count
FROM eligibility.household
GROUP BY state
ORDER BY household_count DESC;

-- Most common population groups
SELECT groupName, COUNT(*) AS member_count
FROM eligibility.population
GROUP BY groupName
ORDER BY member_count DESC;

-- Messages for a household
SELECT householdId, severity, ruleSheet, rule, text
FROM eligibility.messages
WHERE householdId = '161625';

-- Attribute changes for a household
SELECT householdId, rulesheetName, ruleNumber, entityName, attributeName, afterValue, sequence
FROM eligibility.attributeChanges
WHERE householdId = '161625'
ORDER BY sequence;
```
