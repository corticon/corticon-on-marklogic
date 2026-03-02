"use strict";

// Optional utility resource for middle-tier retrieval.
exports.GET = function (context, params) {
  const criteria = params.criteria || "";
  const collection = params.collection || "decision-ledger-output";
  const page = params.page ? parseInt(params.page, 10) : 1;
  const pageLength = params.pageLength ? parseInt(params.pageLength, 10) : 20;

  const q = cts.andQuery([cts.parse(criteria), cts.collectionQuery(collection)]);
  const results = fn
    .subsequence(cts.search(q, ["unfiltered", "unfaceted"]), (page - 1) * pageLength + 1, pageLength)
    .toArray()
    .map((doc) => doc.baseURI);

  context.outputTypes = ["application/json"];
  return {
    estimate: cts.estimate(q),
    page: page,
    pageLength: pageLength,
    results: results
  };
};
