'use strict';

// Example POST handler for querying enriched Medicaid data
var bodyNode = xdmp.getRequestBody();
var body = bodyNode && bodyNode.toObject ? bodyNode.toObject() : null;
var queryText = (body && body.query) ? body.query : null;

var q = [];
q.push(cts.collectionQuery('http://example.com/data/medicaid'));
if (queryText) {
  // Adjust constraints as needed for your demo fields
  q.push(cts.jsonPropertyValueQuery('payload', queryText, ['case-insensitive']));
}

var results = cts.search(cts.andQuery(q));

// Build a simple response
var out = [];
for (var i = 0; i < results.length; i++) {
  var env = results[i].toObject();
  out.push({
    applicationId: env?.payload?.householdId || env?.payload?.applicationId || null,
    decision: env?.corticon || null,
    docUri: xdmp.nodeUri(results[i]) || null
  });
}

xdmp.setResponseContentType('application/json');
out;
