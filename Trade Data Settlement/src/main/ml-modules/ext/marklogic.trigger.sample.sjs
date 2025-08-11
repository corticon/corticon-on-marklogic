'use strict';
/*
  This trigger is executed for each new document created in the http://example.com/data/ledger collection.
  The global variable 'uri' is provided by the trigger mechanism.
*/
var uri;

// 1. Read the just-created document.
const data = cts.doc(uri).toObject();

// 2. Call the decision service.
const decisionService = require("/ext/decisionServiceBundle.js");

const configuration = {
    logLevel: 0,
   executionMetrics: true,
    logFunction: console.log
};


const result = decisionService.execute(data, configuration);

// 3. Normalization: shape output for TDE extraction
function shapeForTDE(originalInput, corticonOutput) {
    // If Corticon output already has "payload" and "corticon", just use as-is:
    if (corticonOutput && corticonOutput.payload && corticonOutput.corticon) {
        return corticonOutput;
    }

    // If the decision service returns a "payload" only (array or object):
    let shaped = {};
    if (Array.isArray(corticonOutput)) {
        shaped.payload = corticonOutput;
    } else if (corticonOutput && corticonOutput.payload) {
        shaped.payload = corticonOutput.payload;
    } else if (corticonOutput) {
        shaped.payload = [corticonOutput];
    } else {
        // fallback: wrap bare ledger data
        shaped.payload = [originalInput];
    }

    // Move any "corticon" property if present, else (optionally) add empty
    if (corticonOutput && corticonOutput.corticon) {
        shaped.corticon = corticonOutput.corticon;
    } else {
        // If the result is split between payload and corticon meta fields
        // You might need custom logic here depending on your decisionService
        Object.keys(corticonOutput || {}).forEach(function(key){
            if (key === "corticon") shaped.corticon = corticonOutput[key];
        });
    }
    // Add inputPayloadUri for traceability, optional
    shaped.inputPayloadUri = uri;
    return shaped;
}

// 4. Normalize output
const normalizedResult = shapeForTDE(data, result);

// 5. Insert enriched/normalized doc (overwrite)
xdmp.documentInsert(uri, normalizedResult, {
    "collections": "http://example.com/data/ledger",
    "permissions": [
        xdmp.permission("corticonml-reader", "read"),
        xdmp.permission("corticonml-writer", "update")
    ]
});
