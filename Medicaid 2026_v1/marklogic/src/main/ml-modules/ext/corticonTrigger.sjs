"use strict";
declareUpdate();

const decisionService = require("/ext/decisionServiceBundle.js");
const COLLECTION_PREFIX = "%%collectionPrefix%%";

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

function attachLedgerMetadata(doc, metadata, payloadField) {
  if (doc && typeof doc === "object" && !Array.isArray(doc)) {
    doc._decisionLedger = Object.assign({}, doc._decisionLedger || {}, metadata);
    return doc;
  }

  const wrapped = { _decisionLedger: metadata };
  wrapped[payloadField || "payload"] = doc;
  return wrapped;
}

try {
  if (String(uri).indexOf("/inputs/processAndEnrich_") === 0) {
    xdmp.log("corticonTrigger skipping resource-managed input URI " + uri);
  } else {
    const input = cts.doc(uri).toObject();
    const result = decisionService.execute(input, {
      logLevel: 0,
      executionMetrics: true,
      logFunction: (msg) => xdmp.log(String(msg))
    });

    const outputUri = "/data/output/" + xdmp.md5(uri) + ".json";
    const outputDoc = attachLedgerMetadata(result, {
      recordType: "output",
      createdBy: "corticonTrigger",
      collectionPrefix: COLLECTION_PREFIX,
      correlationId: xdmp.md5(uri),
      inputPayloadUri: String(uri),
      outputPayloadUri: outputUri
    }, "result");

    xdmp.documentInsert(outputUri, outputDoc, {
      collections: outputCollections(outputDoc),
      permissions: [
        xdmp.permission("%%mlAppName%%-reader", "read"),
        xdmp.permission("%%mlAppName%%-writer", "update")
      ]
    });
  }
} catch (e) {
  xdmp.log("corticonTrigger ERROR for URI " + uri + ": " + e.stack);
}
