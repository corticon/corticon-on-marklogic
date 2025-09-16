'use strict';

/**
 * REST resource to split aggregated JSON into individual documents
 */
function post(context, params, input) {
  // Path of the aggregated JSON document in MarkLogic
  const INPUT_URI = '/data/policy-input/mockaroo_auto_output.json';
  const OUTPUT_PREFIX = '/data/policy-input/';
  const OUTPUT_COLLECTION = 'http://example.com/data/policy-input';

  // Retrieve the source document
  const dataDoc = cts.doc(INPUT_URI);
  if (!dataDoc) {
    return { status: "error", message: `Document not found: ${INPUT_URI}` };
  }

  // Convert the JSON document to a JavaScript array
  const dataArray = dataDoc.toObject();
  if (!Array.isArray(dataArray)) {
    return { status: "error", message: `Expected array at root of ${INPUT_URI}` };
  }

  // Insert each record individually
  let count = 0;
  for (const record of dataArray) {
    const id = record.applicationId || xdmp.random().toString();
    xdmp.documentInsert(OUTPUT_PREFIX + id + '.json', record, { collections: [OUTPUT_COLLECTION] });
    count++;
  }

  return { status: "ok", message: `Inserted ${count} documents` };
}

// Expose the POST function as the REST resource endpoint
exports.POST = post;