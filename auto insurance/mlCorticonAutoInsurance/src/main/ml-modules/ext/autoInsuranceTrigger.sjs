'use strict';
declareUpdate();

const decisionService = require('/ext/decisionServiceBundle.js');

/**
 * Recursively walks through a JSON object and converts any string
 * value that looks like a number into an actual number.
 * @param {object} obj - The object or array to process.
 */
function normalizeNumericStrings(obj) {
  if (obj === null || typeof obj !== 'object') {
    return;
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value === 'string' && !isNaN(value) && !isNaN(parseFloat(value))) {
        // Exclude date-like strings and empty strings
        if (value.trim() !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
           obj[key] = Number(value);
        }
      } else if (typeof value === 'object') {
        // Recurse into nested objects or arrays
        normalizeNumericStrings(value);
      }
    }
  }
}


try {
  // 1) Read the just-created document
  const policy = cts.doc(uri).toObject();
  xdmp.log(`[AutoInsuranceTrigger DEBUG] 1. Read input doc from URI: ${uri}`, "debug");

  // 2) Call the decision service (Simplified Configuration)
  const configuration = {
    logLevel: 0,
    logFunction: (msg) =>
      xdmp.log(
        '[Corticon Decision] ' +
          (typeof msg === 'string' ? msg : JSON.stringify(msg))
      ),
      executionMetrics: true
  };
  const decision = decisionService.execute(policy, configuration);
  xdmp.log(`[AutoInsuranceTrigger DEBUG] 2. Received decision from Corticon.`, "debug");

  // *** NEW STEP: Normalize the data types in the decision object ***
  normalizeNumericStrings(decision);
  xdmp.log(`[AutoInsuranceTrigger DEBUG] Normalized numeric strings in Corticon response.`, "debug");

  // 3) Normalize: Flatten decision payload for TDE robustly
  const decisionObj = decision || {};
  const payloadFromDecision = decisionObj.payload;
  const corticonFromDecision = decisionObj.corticon || {};

  function unwrapPolicyItems(data) {
    if (!data) return [];
    // Recurse into known wrappers
    if (data.payload) return unwrapPolicyItems(data.payload);
    if (data.Policy) return unwrapPolicyItems(data.Policy);
    // If we have an array, process each item inside it
    if (Array.isArray(data)) {
      return data.flatMap(item => unwrapPolicyItems(item));
    }
    // If it's an object that looks like our main policy, return it
    if (typeof data === 'object' && data.applicationId) {
      return [data];
    }
    return [];
  }

  let finalPayloadArray = unwrapPolicyItems(payloadFromDecision);

  // Fallback to using the original input if Corticon returns no payload
  if (finalPayloadArray.length === 0) {
    xdmp.log("[AutoInsuranceTrigger DEBUG] Corticon returned empty payload. Falling back to original input document.", "debug");
    finalPayloadArray = unwrapPolicyItems(policy);
  }

  // Clean any nested 'corticon' objects that Corticon might have left in the payload.
  if (finalPayloadArray.length > 0) {
    finalPayloadArray.forEach(p => {
      if (p.corticon) {
        delete p.corticon;
      }
    });
  }

  // Build the final document
  const finalDocument = {
    payload: finalPayloadArray,
    corticon: corticonFromDecision,
    inputPayloadUri: uri,
  };

  // 4) Persist enriched document
  const finalApplicationId = (finalPayloadArray[0] && finalPayloadArray[0].applicationId) || 'UNKNOWN_ID';
  const outputUri = '/data/policy/' + finalApplicationId + '.json';

  xdmp.documentInsert(outputUri, finalDocument, {
    collections: ['http://example.com/data/policy'],
    permissions: [
      xdmp.permission('corticonml-reader', 'read'),
      xdmp.permission('corticonml-writer', 'update'),
    ],
  });

  xdmp.log(
    '[AutoInsuranceTrigger] Successfully created enriched doc: ' + outputUri
  );
} catch (e) {
  xdmp.log('[AutoInsuranceTrigger] ERROR for URI ' + uri + ': ' + e.stack);
}
