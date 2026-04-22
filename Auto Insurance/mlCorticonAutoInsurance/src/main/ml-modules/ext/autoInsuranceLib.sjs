"use strict";

var op = require("/MarkLogic/optic");
var decisionService = require("/ext/decisionServiceBundle.js");

var COLLECTION_PREFIX = "%%collectionPrefix%%";
var INPUT_COLLECTION_URI = "http://example.com/data/policy-input";
var OUTPUT_COLLECTION_URI = "http://example.com/data/policy";
var READER_ROLE = "%%mlAppName%%-reader";
var WRITER_ROLE = "%%mlAppName%%-writer";

function nowIso() {
  return fn.currentDateTime().toString();
}

function nowForUri() {
  return fn.replace(nowIso(), "[:T.-]", "_");
}

function deepCloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(String(text)) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function uniqueStrings(values) {
  var seen = {};
  var out = [];
  values = values || [];
  for (var i = 0; i < values.length; i++) {
    var value = values[i];
    if (value === null || value === undefined) continue;
    var key = String(value);
    if (!key || seen[key]) continue;
    seen[key] = true;
    out.push(key);
  }
  return out;
}

function hasTraceArtifacts(result) {
  if (!result || typeof result !== "object") {
    return false;
  }

  var corticon = result.corticon;
  if (!corticon || typeof corticon !== "object") {
    return false;
  }

  return !!(
    corticon.Metrics ||
    corticon.metrics ||
    corticon.messages ||
    corticon.trace ||
    corticon.executionTrace
  );
}

function normalizeNumericStrings(obj) {
  if (obj === null || typeof obj !== "object") {
    return;
  }

  Object.keys(obj).forEach(function (key) {
    var value = obj[key];
    if (typeof value === "string" && !isNaN(value) && !isNaN(parseFloat(value))) {
      if (value.trim() !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        obj[key] = Number(value);
      }
    } else if (value && typeof value === "object") {
      normalizeNumericStrings(value);
    }
  });
}

function unwrapPolicyItems(data) {
  if (!data) return [];
  if (data.payload) return unwrapPolicyItems(data.payload);
  if (data.Policy) return unwrapPolicyItems(data.Policy);
  if (Array.isArray(data)) {
    var out = [];
    for (var i = 0; i < data.length; i++) {
      out = out.concat(unwrapPolicyItems(data[i]));
    }
    return out;
  }
  if (typeof data === "object" && data.applicationId) {
    return [data];
  }
  return [];
}

function removeNestedCorticon(payloadItems) {
  payloadItems = payloadItems || [];
  for (var i = 0; i < payloadItems.length; i++) {
    if (payloadItems[i] && payloadItems[i].corticon) {
      delete payloadItems[i].corticon;
    }
  }
}

function extractApplicationId(inputValue) {
  if (!inputValue) return null;
  if (Array.isArray(inputValue)) {
    for (var i = 0; i < inputValue.length; i++) {
      var nestedId = extractApplicationId(inputValue[i]);
      if (nestedId) return nestedId;
    }
    return null;
  }
  if (typeof inputValue === "object") {
    if (inputValue.applicationId) return String(inputValue.applicationId);
    if (inputValue.payload) return extractApplicationId(inputValue.payload);
  }
  return null;
}

function inputCollections() {
  return uniqueStrings([
    COLLECTION_PREFIX,
    COLLECTION_PREFIX + "_input",
    INPUT_COLLECTION_URI
  ]);
}

function outputCollections(hasTrace) {
  var collections = [
    COLLECTION_PREFIX,
    COLLECTION_PREFIX + "_output",
    OUTPUT_COLLECTION_URI
  ];
  if (hasTrace) {
    collections.push(COLLECTION_PREFIX + "_trace");
  }
  return uniqueStrings(collections);
}

function outputCollectionQuery() {
  return cts.orQuery([
    cts.collectionQuery(OUTPUT_COLLECTION_URI),
    cts.collectionQuery(COLLECTION_PREFIX + "_output")
  ]);
}

function makePermissions() {
  return [
    xdmp.permission(READER_ROLE, "read"),
    xdmp.permission(WRITER_ROLE, "update")
  ];
}

function attachLedgerMetadata(doc, metadata, payloadField) {
  if (doc && typeof doc === "object" && !Array.isArray(doc)) {
    doc._decisionLedger = Object.assign({}, doc._decisionLedger || {}, metadata);
    return doc;
  }

  var wrapped = { _decisionLedger: metadata };
  wrapped[payloadField || "payload"] = doc;
  return wrapped;
}

function makeDecisionConfig(logPrefix, extraConfig) {
  var config = {
    logLevel: 0,
    executionMetrics: true,
    logPerfData: true,
    logFunction: function (msg) {
      xdmp.log("[" + (logPrefix || "AutoInsurance") + "] " + (typeof msg === "string" ? msg : JSON.stringify(msg)));
    }
  };

  if (extraConfig && typeof extraConfig === "object") {
    Object.keys(extraConfig).forEach(function (key) {
      config[key] = extraConfig[key];
    });
  }

  return config;
}

function executePolicy(policy, options) {
  options = options || {};

  var sourcePolicy = deepCloneJson(policy);
  var executionInput = deepCloneJson(policy);
  var decision = decisionService.execute(
    executionInput,
    makeDecisionConfig(options.logPrefix || "AutoInsurance", options.decisionConfig)
  );

  normalizeNumericStrings(decision);

  var finalPayload = unwrapPolicyItems(decision && decision.payload);
  if (!finalPayload.length) {
    finalPayload = unwrapPolicyItems(sourcePolicy);
  }
  removeNestedCorticon(finalPayload);

  var applicationId =
    options.applicationId ||
    extractApplicationId(finalPayload) ||
    extractApplicationId(sourcePolicy) ||
    ("policy_" + nowForUri());

  var inputUri = options.inputUri || ("/data/policy-input/" + applicationId + ".json");
  var outputUri = options.outputUri || ("/data/policy/" + applicationId + ".json");
  var traceEnabled = hasTraceArtifacts(decision);

  var ledgerMetadata = Object.assign(
    {
      applicationId: applicationId,
      createdAt: nowIso(),
      createdBy: options.createdBy || "autoInsurance",
      invocationMode: options.invocationMode || "runtime",
      collectionPrefix: COLLECTION_PREFIX,
      inputPayloadUri: inputUri,
      outputPayloadUri: outputUri,
      traceCollectionApplied: traceEnabled
    },
    options.additionalMetadata || {}
  );

  var inputDoc = attachLedgerMetadata(sourcePolicy, Object.assign({}, ledgerMetadata, {
    recordType: "input"
  }), "payload");

  var outputDoc = {
    payload: finalPayload,
    corticon: decision && decision.corticon ? decision.corticon : {},
    inputPayloadUri: inputUri,
    _decisionLedger: Object.assign({}, ledgerMetadata, {
      recordType: "output"
    })
  };

  return {
    applicationId: applicationId,
    inputUri: inputUri,
    outputUri: outputUri,
    inputDocument: inputDoc,
    outputDocument: outputDoc,
    inputCollections: inputCollections(),
    outputCollections: outputCollections(traceEnabled),
    traceEnabled: traceEnabled,
    decision: decision
  };
}

function insertDocument(uri, document, collections) {
  xdmp.documentInsert(uri, document, {
    collections: collections,
    permissions: makePermissions(),
    quality: 1
  });
}

function writeExecutionResult(result, options) {
  options = options || {};
  if (options.writeInput !== false) {
    insertDocument(result.inputUri, result.inputDocument, result.inputCollections);
  }
  if (options.writeOutput !== false) {
    insertDocument(result.outputUri, result.outputDocument, result.outputCollections);
  }
  return result;
}

function readDocAsObject(uri) {
  var doc = cts.doc(uri);
  if (!doc) return null;
  if (doc.root && typeof doc.root.toObject === "function") return doc.root.toObject();
  if (typeof doc.toObject === "function") return doc.toObject();
  return null;
}

function processExistingUri(uri, options) {
  var policy = readDocAsObject(uri);
  if (!policy) {
    throw new Error("Policy document not found for URI: " + uri);
  }

  var result = executePolicy(policy, Object.assign({}, options || {}, {
    inputUri: uri,
    invocationMode: (options && options.invocationMode) || "trigger",
    additionalMetadata: Object.assign({}, options && options.additionalMetadata ? options.additionalMetadata : {}, {
      sourceUri: uri
    })
  }));

  writeExecutionResult(result, { writeInput: false, writeOutput: true });
  return result;
}

function stripQualifier(key) {
  var idx = String(key).lastIndexOf(".");
  return idx >= 0 ? String(key).substring(idx + 1) : String(key);
}

function normalizeRow(row) {
  if (!row || typeof row !== "object") return row;
  var out = {};
  Object.keys(row).forEach(function (key) {
    out[stripQualifier(key)] = row[key];
  });
  return out;
}

function normalizeRows(rows) {
  rows = rows || [];
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    out.push(normalizeRow(rows[i]));
  }
  return out;
}

function rowsFromView(schemaName, viewName, scanLimit) {
  var limit = scanLimit || 5000;
  return normalizeRows(op.fromView(schemaName, viewName).limit(limit).result().toArray());
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function normalizeText(value) {
  return hasValue(value) ? String(value).trim() : "";
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function containsCI(value, search) {
  if (!hasValue(search)) return true;
  return normalizeLower(value).indexOf(normalizeLower(search)) >= 0;
}

function equalsCI(value, expected) {
  if (!hasValue(expected)) return true;
  return normalizeLower(value) === normalizeLower(expected);
}

function topCounts(rows, fieldName, limit, nullLabel) {
  var counts = {};
  rows = rows || [];
  for (var i = 0; i < rows.length; i++) {
    var value = rows[i] && rows[i][fieldName];
    var label = hasValue(value) ? String(value) : (nullLabel || "(none)");
    counts[label] = (counts[label] || 0) + 1;
  }

  return Object.keys(counts)
    .map(function (key) { return { value: key, count: counts[key] }; })
    .sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return String(a.value).localeCompare(String(b.value));
    })
    .slice(0, limit || 20);
}

module.exports = {
  COLLECTION_PREFIX: COLLECTION_PREFIX,
  INPUT_COLLECTION_URI: INPUT_COLLECTION_URI,
  OUTPUT_COLLECTION_URI: OUTPUT_COLLECTION_URI,
  nowIso: nowIso,
  nowForUri: nowForUri,
  deepCloneJson: deepCloneJson,
  safeJsonParse: safeJsonParse,
  hasTraceArtifacts: hasTraceArtifacts,
  normalizeNumericStrings: normalizeNumericStrings,
  unwrapPolicyItems: unwrapPolicyItems,
  removeNestedCorticon: removeNestedCorticon,
  extractApplicationId: extractApplicationId,
  inputCollections: inputCollections,
  outputCollections: outputCollections,
  outputCollectionQuery: outputCollectionQuery,
  makePermissions: makePermissions,
  attachLedgerMetadata: attachLedgerMetadata,
  executePolicy: executePolicy,
  writeExecutionResult: writeExecutionResult,
  readDocAsObject: readDocAsObject,
  processExistingUri: processExistingUri,
  normalizeRow: normalizeRow,
  normalizeRows: normalizeRows,
  rowsFromView: rowsFromView,
  hasValue: hasValue,
  normalizeText: normalizeText,
  normalizeLower: normalizeLower,
  containsCI: containsCI,
  equalsCI: equalsCI,
  topCounts: topCounts
};