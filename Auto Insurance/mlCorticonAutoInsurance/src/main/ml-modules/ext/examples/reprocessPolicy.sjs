"use strict";
declareUpdate();

var lib = require("/ext/autoInsuranceLib.sjs");

if (typeof inputUri === "undefined" || inputUri === null) {
  throw new Error("reprocessPolicy.sjs requires external variable 'inputUri'");
}

var result = lib.processExistingUri(String(inputUri), {
  createdBy: "reprocessPolicyExample",
  invocationMode: "replay",
  logPrefix: "ReprocessPolicy",
  additionalMetadata: {
    replayReason: (typeof replayReason !== "undefined" && replayReason !== null) ? String(replayReason) : "manual-replay"
  }
});

({
  ok: true,
  message: "Policy successfully reprocessed",
  applicationId: result.applicationId,
  inputUri: result.inputUri,
  outputUri: result.outputUri,
  outputCollections: result.outputCollections,
  traceEnabled: result.traceEnabled
});