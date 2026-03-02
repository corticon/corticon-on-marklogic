"use strict";

const decisionService = require("/ext/decisionServiceBundle.js");

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
    correlationId: existing.correlationId || xdmp.md5(outputPayloadUri + "|" + fn.currentDateTime().toString()),
    entityId: existing.entityId || inferEntityId(input),
    inputPayloadUri: existing.inputPayloadUri || inputPayloadUri || null,
    outputPayloadUri: existing.outputPayloadUri || outputPayloadUri || null,
    processedAt: existing.processedAt || fn.currentDateTime().toString()
  });

  return base;
}

exports.POST = function (context) {
  try {
    const bodyText = xdmp.getRequestBody("text");
    const parsed = safeParse(bodyText);
    if (!parsed.ok) {
      context.outputTypes = ["application/json"];
      return { error: true, message: "Invalid JSON input", details: parsed.error };
    }

    const config = {
      logLevel: 1,
      executionMetrics: true,
      logPerfData: true,
      logFunction: (msg) => xdmp.log(String(msg))
    };

    const result = decisionService.execute(parsed.value, config);
    const uri = "/results/processAndEnrich_" + nowForUri() + ".json";
    const enrichedResult = withLedgerMetadata(result, parsed.value, null, uri);

    xdmp.invokeFunction(
      function () {
        xdmp.documentInsert(uri, enrichedResult, {
          collections: ["decision-ledger-output", "decision-ledger-audit"],
          permissions: [
            xdmp.permission("%%mlAppName%%-reader", "read"),
            xdmp.permission("%%mlAppName%%-writer", "update")
          ],
          quality: 1
        });
      },
      { update: "true" }
    );

    context.outputTypes = ["application/json"];
    return {
      message: "Corticon execution successful",
      uri: uri,
      correlationId: enrichedResult._decisionLedger.correlationId,
      entityId: enrichedResult._decisionLedger.entityId
    };
  } catch (e) {
    xdmp.log("processAndEnrich ERROR: " + e.stack);
    context.outputTypes = ["application/json"];
    return { error: true, message: e.message, stack: e.stack };
  }
};
