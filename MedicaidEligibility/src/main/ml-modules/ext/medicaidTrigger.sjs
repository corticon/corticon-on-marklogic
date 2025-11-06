'use strict';
declareUpdate();

const inputUri = uri;

const inputDoc = cts.doc(inputUri);
const inputObj = inputDoc ? inputDoc.toObject() : null;

if (!inputObj) {
  xdmp.log(`[Medicaid Trigger] No document found at ${inputUri}`, 'warning');
  xdmp.commit();
}

const decisionService = require('/ext/medicaidDecisionServiceBundle.js');
const configuration = {
  logLevel: 0,
  logFunction: (msg) => xdmp.log('[Corticon Decision] ' + msg),
  executionMetrics: true
};
const decision = decisionService.execute(inputObj, configuration);

function normalizeNumericStrings(node) {
  if (Array.isArray(node)) return node.map(normalizeNumericStrings);
  if (node && typeof node === 'object') {
    const out = {};
    for (const k in node) {
      const v = node[k];
      if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) out[k] = Number(v);
      else out[k] = normalizeNumericStrings(v);
    }
    return out;
  }
  return node;
}
const normalized = normalizeNumericStrings(decision);

function unwrapMedicaidPayload(result, fallback) {
  if (result?.householdId && result?.individual && result?.corticon) {
    return result;
  }
  if (result?.data?.payload) return result.data.payload;
  if (result?.data?.Medicaid) return result.data.Medicaid;
  if (result?.data?.Applicant) return result.data.Applicant;
  if (Array.isArray(result?.data)) return result.data;
  return result ?? fallback;
}
const payload = unwrapMedicaidPayload(normalized, inputObj);

const appId = payload?.householdId ?? payload?.applicationId ?? payload?.applicantId ?? 'UNKNOWN_ID';
const timestamp = fn.currentDateTime().toString();
const envelope = {
  payload,
  corticon: {
    execution: normalized?.corticon ?? normalized,
    inputPayloadUri: inputUri,
    timestamp,
    enrichmentVersion: '2.0'
  }
};

const newUri = `/data/medicaid/${appId}.json`;
try {
  xdmp.documentInsert(
    newUri,
    envelope,
    {
      collections: ['http://example.com/data/medicaid'],
      permissions: xdmp.defaultPermissions(),
      metadata: { source: 'corticon', inputUri: inputUri, enrichedAt: timestamp }
    }
  );
  xdmp.log(`[Medicaid Trigger] Enriched document created at ${newUri}`, 'info');
} catch (e) {
  xdmp.log(`[Medicaid Trigger] Error inserting ${newUri}: ${e.toString()}`, 'error');
  throw e;
}