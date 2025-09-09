'use strict';

const search = require('/MarkLogic/appservices/search/search.xqy');

/**
 * Return one policy by applicationId
 */
function getPolicy(applicationId) {
  const query = cts.andQuery([
    cts.collectionQuery("http://example.com/data/policy"),
    cts.jsonPropertyValueQuery("applicationId", applicationId)
  ]);

  const results = cts.search(query).toArray();
  if (!results.length) return { error: "Policy not found", applicationId };
  return results[0].root || results[0];
}
/**
 * Run a qtext search against corticonml-options.xml
 * Returns array of full documents matching the search
 */
function searchPolicies(qtext) {
  const query = cts.andQuery([
    cts.collectionQuery("http://example.com/data/policy"),
    cts.jsonPropertyValueQuery("applicationId", qtext)
  ]);

  const results = cts.search(query).toArray();
  return results.map(doc => doc.root || doc);
}

/**
 * Main GET entry point for the resource
 */
exports.GET = function(context, params) {
  if (params.action === 'getPolicy' && params.applicationId) {
    return getPolicy(params.applicationId);
  }
  if (params.action === 'searchPolicies' && params.q) {
    const results = searchPolicies(params.q);
    return { results, count: results.length };
  }
  return { error: 'Unsupported action', params };
};