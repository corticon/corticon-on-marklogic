'use strict';

const lib = require('/ext/autoInsuranceLib.sjs');

function getParam(params, name, defaultValue) {
  if (!params) return defaultValue;
  const rsName = 'rs:' + name;
  if (params[rsName] !== null && params[rsName] !== undefined) return params[rsName];
  if (params[name] !== null && params[name] !== undefined) return params[name];
  return defaultValue;
}

function toObject(doc) {
  if (!doc) return null;
  if (doc.root && typeof doc.root.toObject === 'function') return doc.root.toObject();
  if (typeof doc.toObject === 'function') return doc.toObject();
  return doc;
}

function sortPolicies(docs) {
  return docs.sort((left, right) => {
    const leftId = String((left && left.payload && left.payload[0] && left.payload[0].applicationId) || '');
    const rightId = String((right && right.payload && right.payload[0] && right.payload[0].applicationId) || '');
    return leftId.localeCompare(rightId);
  });
}

function pageResults(results, page, pageLength) {
  const start = Math.max(0, (page - 1) * pageLength);
  return results.slice(start, start + pageLength);
}

function buildSearchQuery(qtext) {
  const queries = [lib.outputCollectionQuery()];
  if (lib.hasValue(qtext)) {
    queries.push(cts.orQuery([
      cts.jsonPropertyWordQuery('applicationId', qtext),
      cts.jsonPropertyWordQuery('familyName', qtext),
      cts.jsonPropertyWordQuery('state', qtext),
      cts.jsonPropertyWordQuery('first', qtext),
      cts.jsonPropertyWordQuery('last', qtext),
      cts.wordQuery(qtext)
    ]));
  }
  return cts.andQuery(queries);
}

/**
 * Return one policy by applicationId
 */
function getPolicy(applicationId) {
  const query = cts.andQuery([lib.outputCollectionQuery(), cts.jsonPropertyValueQuery('applicationId', applicationId)]);
  const results = cts.search(query).toArray();
  if (!results.length) return { error: "Policy not found", applicationId };
  return toObject(results[0]);
}

/**
 * Run a qtext search to get all policies for the map view.
 * It is meant to be called with an empty qtext.
 */
function searchPolicies(qtext, page, pageLength) {
  const query = buildSearchQuery(qtext);
  const results = sortPolicies(cts.search(query).toArray().map(toObject));
  return {
    results: pageResults(results, page, pageLength),
    count: results.length,
    page,
    pageLength,
    facets: {
      states: lib.topCounts(results.map(doc => (doc && doc.payload && doc.payload[0]) || {}), 'state', 20, '(none)')
    }
  };
}

/**
 * Search policies for the typeahead and search bar.
 */
function searchPoliciesByQtext(qtext) {
  return searchPolicies(qtext, 1, 25);
}

/**
 * Main GET entry point for the resource
 */
exports.GET = function(context, params) {
  const page = Math.max(1, parseInt(getParam(params, 'page', '1'), 10) || 1);
  const pageLength = Math.max(1, parseInt(getParam(params, 'pageLength', '50'), 10) || 50);
  if (params.action === 'getPolicy' && params.applicationId) {
    return getPolicy(params.applicationId);
  }
  if (params.action === 'searchPolicies') {
    return searchPolicies(getParam(params, 'q', ''), page, pageLength);
  }
  if (params.action === 'searchPoliciesByQtext' && params.q) {
    return searchPoliciesByQtext(params.q);
  }
  return { error: 'Unsupported action', params };
};