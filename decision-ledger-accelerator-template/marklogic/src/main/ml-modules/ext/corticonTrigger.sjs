"use strict";
declareUpdate();

const decisionService = require("/ext/decisionServiceBundle.js");

try {
  const input = cts.doc(uri).toObject();
  const result = decisionService.execute(input, {
    logLevel: 0,
    executionMetrics: true,
    logFunction: (msg) => xdmp.log(String(msg))
  });

  const outputUri = "/data/output/" + xdmp.md5(uri) + ".json";
  xdmp.documentInsert(outputUri, result, {
    collections: ["corticon-results", "fraud-detection", "decision-audit"],
    permissions: [
      xdmp.permission("%%mlAppName%%-reader", "read"),
      xdmp.permission("%%mlAppName%%-writer", "update")
    ]
  });
} catch (e) {
  xdmp.log("corticonTrigger ERROR for URI " + uri + ": " + e.stack);
}

