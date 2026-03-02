"use strict";
declareUpdate();

const decisionService = require("/ext/decisionServiceBundle.js");

function inferEntityId(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  if (input.entityId) {
    return String(input.entityId);
  }

  if (input.id) {
    return String(input.id);
  }

  if (input.payload && typeof input.payload === "object") {
    if (input.payload.entityId) {
      return String(input.payload.entityId);
    }
    if (input.payload.id) {
      return String(input.payload.id);
    }
  }

  return null;
}

function withLedgerMetadata(result, input, inputPayloadUri, outputPayloadUri) {
  const base = result && typeof result === "object" ? result : { payload: input };
  const existing = base._decisionLedger && typeof base._decisionLedger === "object" ? base._decisionLedger : {};

  base._decisionLedger = Object.assign({}, existing, {
    correlationId: existing.correlationId || xdmp.md5(outputPayloadUri + "|" + inputPayloadUri),
    entityId: existing.entityId || inferEntityId(input),
    inputPayloadUri: existing.inputPayloadUri || inputPayloadUri || null,
    outputPayloadUri: existing.outputPayloadUri || outputPayloadUri || null,
    processedAt: existing.processedAt || fn.currentDateTime().toString()
  });

  return base;
}

try {
  const input = cts.doc(uri).toObject();
  const result = decisionService.execute(input, {
    logLevel: 0,
    executionMetrics: true,
    logFunction: (msg) => xdmp.log(String(msg))
  });

  const outputUri = "/data/output/" + xdmp.md5(uri) + ".json";
  const enrichedResult = withLedgerMetadata(result, input, uri, outputUri);

  xdmp.documentInsert(outputUri, enrichedResult, {
    collections: ["decision-ledger-output", "decision-ledger-audit"],
    permissions: [
      xdmp.permission("%%mlAppName%%-reader", "read"),
      xdmp.permission("%%mlAppName%%-writer", "update")
    ]
  });
} catch (e) {
  xdmp.log("corticonTrigger ERROR for URI " + uri + ": " + e.stack);
}
