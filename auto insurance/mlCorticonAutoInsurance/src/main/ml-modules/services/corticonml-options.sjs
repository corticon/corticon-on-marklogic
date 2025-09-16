// Data and Decisioning/src/main/ml-modules/services/corticonml-options.sjs

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
 * Run a qtext search to get all policies for the map view.
 * It is meant to be called with an empty qtext.
 */
function searchPolicies() {
  const query = cts.collectionQuery("http://example.com/data/policy");
  const results = cts.search(query).toArray();
  return results.map(doc => doc.root || doc);
}

/**
 * Run a qtext search against corticonml-options.xml
 * Returns array of full documents matching the search
 */
function searchPoliciesByQtext(qtext) {
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
  if (params.action === 'searchPolicies') {
    const results = searchPolicies();
    return { results, count: results.length };
  }
  if (params.action === 'searchPoliciesByQtext' && params.q) {
    const results = searchPoliciesByQtext(params.q);
    return { results, count: results.length };
  }
  return { error: 'Unsupported action', params };
};