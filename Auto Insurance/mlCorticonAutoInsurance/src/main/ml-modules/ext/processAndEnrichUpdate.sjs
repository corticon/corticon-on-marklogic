"use strict";
declareUpdate();

var lib = require("/ext/autoInsuranceLib.sjs");

if (typeof bodyText === "undefined" || bodyText === null) {
  throw new Error("processAndEnrichUpdate.sjs requires external variable 'bodyText'");
}

var parsed = lib.safeJsonParse(String(bodyText));
if (!parsed.ok) {
  ({ ok: false, error: true, message: "Invalid JSON input", details: parsed.error });
} else {
  var value = parsed.value;
  if (Array.isArray(value)) {
    var batchItems = value.map(function (item, index) {
      var result = lib.executePolicy(item, {
        createdBy: "processAndEnrich",
        invocationMode: "resource",
        logPrefix: "processAndEnrich",
        additionalMetadata: {
          batch: true,
          batchIndex: index + 1
        }
      });
      lib.writeExecutionResult(result, { writeInput: true, writeOutput: true });
      return {
        applicationId: result.applicationId,
        inputUri: result.inputUri,
        outputUri: result.outputUri,
        traceEnabled: result.traceEnabled
      };
    });

    ({
      ok: true,
      message: "Corticon execution successful (batch)",
      batch: true,
      count: batchItems.length,
      items: batchItems
    });
  } else {
    var singleResult = lib.executePolicy(value, {
      createdBy: "processAndEnrich",
      invocationMode: "resource",
      logPrefix: "processAndEnrich"
    });
    lib.writeExecutionResult(singleResult, { writeInput: true, writeOutput: true });

    ({
      ok: true,
      message: "Corticon execution successful",
      batch: false,
      applicationId: singleResult.applicationId,
      inputUri: singleResult.inputUri,
      outputUri: singleResult.outputUri,
      inputCollections: singleResult.inputCollections,
      outputCollections: singleResult.outputCollections,
      traceEnabled: singleResult.traceEnabled,
      policy: singleResult.outputDocument
    });
  }
}