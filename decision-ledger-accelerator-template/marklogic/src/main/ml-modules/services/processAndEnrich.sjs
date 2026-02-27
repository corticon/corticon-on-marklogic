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

    xdmp.invokeFunction(
      function () {
        xdmp.documentInsert(uri, result, {
          collections: ["corticon-results", "fraud-detection", "decision-audit"],
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
    return { message: "Corticon execution successful", uri: uri };
  } catch (e) {
    xdmp.log("processAndEnrich ERROR: " + e.stack);
    context.outputTypes = ["application/json"];
    return { error: true, message: e.message, stack: e.stack };
  }
};

