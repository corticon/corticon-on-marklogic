"use strict";
declareUpdate();

const decisionService = require("/ext/decisionServiceBundle.js");
const COLLECTION_PREFIX = "%%collectionPrefix%%";
const READER_ROLE = "%%mlAppName%%-reader";
const WRITER_ROLE = "%%mlAppName%%-writer";

function nowForUri() {
  const now = fn.currentDateTime().toString();
  return fn.replace(now, "[:T.-]", "_");
}

function deepCloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasTraceArtifacts(result) {
  if (!result || typeof result !== "object") {
    return false;
  }

  const corticon = result.corticon;
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

function outputCollections(result) {
  const collections = [COLLECTION_PREFIX, COLLECTION_PREFIX + "_output"];
  if (hasTraceArtifacts(result)) {
    collections.push(COLLECTION_PREFIX + "_trace");
  }
  return collections;
}

function inputCollections() {
  return [COLLECTION_PREFIX, COLLECTION_PREFIX + "_input"];
}

function attachLedgerMetadata(doc, metadata, payloadField) {
  if (doc && typeof doc === "object" && !Array.isArray(doc)) {
    doc._decisionLedger = Object.assign({}, doc._decisionLedger || {}, metadata);
    return doc;
  }

  const wrapped = { _decisionLedger: metadata };
  wrapped[payloadField || "payload"] = doc;
  return wrapped;
}

const config = {
  logLevel: 1,
  executionMetrics: true,
  logPerfData: true,
  logFunction: (msg) => xdmp.log(String(msg))
};

if (typeof bodyText === "undefined" || bodyText === null) {
  throw new Error("processAndEnrichUpdate.sjs requires external variable 'bodyText'");
}

const requestBodyText = String(bodyText);
const requestValue = JSON.parse(requestBodyText);
const inCollections = inputCollections();

function insertPair(requestPayload, suffix) {
  const correlationId = suffix ? nowForUri() + "_" + suffix : nowForUri();
  const inputUri = "/inputs/processAndEnrich_" + correlationId + ".json";
  const outputUri = "/results/processAndEnrich_" + correlationId + ".json";
  const originalInput = deepCloneJson(requestPayload);
  const result = decisionService.execute(requestPayload, config);
  const outCollections = outputCollections(result);

  const inputDoc = attachLedgerMetadata(originalInput, {
    recordType: "input",
    createdBy: "processAndEnrich",
    collectionPrefix: COLLECTION_PREFIX,
    correlationId: correlationId,
    outputPayloadUri: outputUri
  }, "payload");

  const outputDoc = attachLedgerMetadata(result, {
    recordType: "output",
    createdBy: "processAndEnrich",
    collectionPrefix: COLLECTION_PREFIX,
    correlationId: correlationId,
    inputPayloadUri: inputUri,
    outputPayloadUri: outputUri
  }, "result");

  xdmp.documentInsert(inputUri, inputDoc, {
    collections: inCollections,
    permissions: [
      xdmp.permission(READER_ROLE, "read"),
      xdmp.permission(WRITER_ROLE, "update")
    ],
    quality: 1
  });

  xdmp.documentInsert(outputUri, outputDoc, {
    collections: outCollections,
    permissions: [
      xdmp.permission(READER_ROLE, "read"),
      xdmp.permission(WRITER_ROLE, "update")
    ],
    quality: 1
  });

  return {
    correlationId: correlationId,
    uri: outputUri,
    inputUri: inputUri,
    outputUri: outputUri,
    inputCollections: inCollections,
    outputCollections: outCollections
  };
}

if (Array.isArray(requestValue)) {
  const items = requestValue.map((item, index) => insertPair(item, String(index + 1)));
  ({
    message: "Corticon execution successful (batch)",
    batch: true,
    count: items.length,
    items: items
  });
} else {
  const item = insertPair(requestValue, null);
  ({
    message: "Corticon execution successful",
    batch: false,
    count: 1,
    correlationId: item.correlationId,
    uri: item.outputUri,
    inputUri: item.inputUri,
    outputUri: item.outputUri,
    inputCollections: item.inputCollections,
    outputCollections: item.outputCollections
  });
}
