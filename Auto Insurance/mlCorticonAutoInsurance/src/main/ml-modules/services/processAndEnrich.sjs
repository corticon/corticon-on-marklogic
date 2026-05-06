"use strict";

exports.POST = function (context) {
  try {
    var bodyText = String(xdmp.getRequestBody("text"));
    var response = fn.head(
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
    return { ok: false, error: true, message: e.message, stack: e.stack };
  }
};