"use strict";

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

function inputCollections() {
  return [COLLECTION_PREFIX, COLLECTION_PREFIX + "_input"];
}

function deepCloneJson(value) {
  return JSON.parse(JSON.stringify(value));
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

function safeParse(bodyText) {
  try {
    return { ok: true, value: JSON.parse(bodyText) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function nowForUri() {
  const now = fn.currentDateTime().toString();
  return fn.replace(now, "[:T.-]", "_");
}

exports.POST = function (context) {
  try {
    const bodyText = String(xdmp.getRequestBody("text"));
    const parsed = safeParse(bodyText);
    if (!parsed.ok) {
      context.outputTypes = ["application/json"];
      return { error: true, message: "Invalid JSON input", details: parsed.error };
    }

    const response = fn.head(
      xdmp.invoke(
        "/ext/processAndEnrichUpdate.sjs",
        { bodyText: bodyText },
        { update: "true" }
      )
    );

    context.outputTypes = ["application/json"];
    return response;
  } catch (e) {
    xdmp.log("processAndEnrich ERROR: " + e.stack);
    context.outputTypes = ["application/json"];
    return { error: true, message: e.message, stack: e.stack };
  }
};
