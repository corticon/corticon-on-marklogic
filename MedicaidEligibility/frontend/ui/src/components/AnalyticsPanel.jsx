app.get('/api/analytics', async (req, res) => {
  const type = req.query.type;
  let sql;

  switch (type) {
    case 'mostCommonAssistance':
      sql = `
        SELECT name AS assistanceProgram, COUNT(*) AS count
        FROM household.classOfAssistance
        WHERE name IS NOT NULL
        GROUP BY name
        ORDER BY count DESC
        LIMIT 10;
      `;
      break;

    case 'eligibilityByAgeGroup':
      sql = `
        SELECT
          CASE
            WHEN age < 19 THEN 'Child (0-18)'
            WHEN age BETWEEN 19 AND 64 THEN 'Adult (19-64)'
            ELSE 'Senior (65+)' END AS ageGroup,
          COUNT(*) AS individuals
        FROM household.individual
        WHERE age IS NOT NULL
        GROUP BY ageGroup
        ORDER BY individuals DESC;
      `;
      break;

    case 'nearMissFPL':
      sql = `
        SELECT householdId, state, annualIncome, householdPercentFPL
        FROM household.household
        WHERE householdPercentFPL BETWEEN 1.9 AND 2.1
        ORDER BY householdPercentFPL;
      `;
      break;

    case 'avgIncomeByFamilySize':
      sql = `
        SELECT familySize, ROUND(AVG(annualIncome), 2) AS avgIncome
        FROM household.household
        WHERE familySize IS NOT NULL
        GROUP BY familySize
        ORDER BY familySize;
      `;
      break;

    case 'topDenialReasons':
      sql = `
        SELECT text AS reason, COUNT(*) AS occurrences
        FROM household.eligibilityNote
        WHERE text LIKE '%ineligible%' OR text LIKE '%denied%'
        GROUP BY text
        ORDER BY occurrences DESC
        LIMIT 10;
      `;
      break;

    default:
      return res.status(400).json({ error: 'Unknown analytics type' });
  }

  console.log(`(Analytics) Running SQL: ${sql.trim().slice(0, 80)}...`);

  const options = {
    hostname: mlHost,
    port: mlRestPort,
    path: '/v1/rows?format=json',
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(mlUser + ':' + mlPass).toString('base64'),
      'Content-Type': 'application/sql',
    },
  };

  const mlReq = http.request(options, (mlRes) => {
    let data = '';
    mlRes.on('data', (chunk) => (data += chunk));
    mlRes.on('end', () => {
      try {
        res.json(JSON.parse(data));
      } catch (e) {
        console.error('(Analytics) Failed to parse:', e);
        res.status(500).json({ error: 'Invalid JSON from MarkLogic', raw: data });
      }
    });
  });

  mlReq.on('error', (e) => {
    console.error('(Analytics) HTTP error:', e);
    res.status(500).json({ error: e.message });
  });

  mlReq.write(sql);
  mlReq.end();
});
