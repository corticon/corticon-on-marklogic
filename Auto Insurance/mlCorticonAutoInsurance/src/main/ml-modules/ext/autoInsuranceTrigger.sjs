'use strict';
declareUpdate();

const lib = require('/ext/autoInsuranceLib.sjs');

try {
  const result = lib.processExistingUri(uri, {
    createdBy: 'autoInsuranceTrigger',
    invocationMode: 'trigger',
    logPrefix: 'AutoInsuranceTrigger'
  });

  xdmp.log('[AutoInsuranceTrigger] Successfully created enriched doc: ' + result.outputUri);
} catch (e) {
  xdmp.log('[AutoInsuranceTrigger] ERROR for URI ' + uri + ': ' + e.stack);
}
