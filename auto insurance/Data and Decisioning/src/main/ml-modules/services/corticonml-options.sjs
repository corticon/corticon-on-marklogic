'use strict';

/// Helper: get doc by URI
function getDocument(uri) {
  return fn.doc(uri);
}

/// Return one policy by its applicationId
function getPolicy(applicationId) {
  const results = cts.search(
    cts.andQuery([
      cts.collectionQuery("http://example.com/data/policy"),
      cts.jsonPropertyValueQuery("applicationId", applicationId)
    ])
  ).toArray();

  if (results.length === 0) {
    return { error: "Policy not found", applicationId };
  }

  return results[0];
}

/// Build a cts query based on constraints XML + input parameters
function buildQueryFromOptions(params) {
  const constraintsDoc = fn.doc('/Default/corticonml-rest/rest-api/options/corticonml-options.xml');

  const queries = [];

  // Iterate over <constraint> elements
  for (const constraint of constraintsDoc.xpath('/options/constraint')) {
    const name = constraint.getAttribute('name');
    const value = params[name];

    if (value != null) {
      // Determine the type: decimal, string, int, date
      const typeEl = constraint.xpath('./range/@type')[0];
      const type = typeEl ? typeEl.value : 'xs:string';

      const pathIndex = constraint.xpath('./range/path-index/text()')[0] ||
                        constraint.xpath('./collection/text()')[0];

      if (!pathIndex) continue;

      // Convert type if needed
      let convertedValue = value;
      if (type === 'xs:int') convertedValue = parseInt(value, 10);
      else if (type === 'xs:decimal') convertedValue = parseFloat(value);
      else if (type === 'xs:date') convertedValue = new Date(value);

      queries.push(cts.jsonPropertyValueQuery(pathIndex.trim(), convertedValue));
    }
  }

  // Always limit to policy collection
  queries.push(cts.collectionQuery("http://example.com/data/policy"));

  return cts.andQuery(queries);
}

/// Run a search respecting the constraints in corticonml-options.xml
function searchPolicies(params) {
  const qtext = params.q || null;
  const ctsQuery = buildQueryFromOptions(params);

  // If qtext is present, add a wordQuery
  const finalQuery = qtext ? cts.andQuery([ctsQuery, cts.wordQuery(qtext)]) : ctsQuery;

  const results = cts.search(finalQuery).toArray();

  const hits = results.map(r => r.root || getDocument(r.uri));

  return { results: hits, count: hits.length };
}

/// REST entry point
exports.GET = function(context, params) {
  if (params.action === 'getPolicy' && params.applicationId) {
    return getPolicy(params.applicationId);
  }

  if (params.action === 'searchPolicies') {
    return searchPolicies(params);
  }

  return {
    error: 'Unsupported action',
    params
  };
};
