'use strict';

var SERVICE_VERSION = "eligibility-options-2026-01-12-a";
var COLLECTION = 'http://example.com/data/eligibility-output';

function docToObject(doc) {
  if (!doc) return null;

  try {
    if (typeof doc.toObject === 'function') {
      return doc.toObject();
    }
  } catch (e1) {}

  try {
    if (doc.root && typeof doc.root.toObject === 'function') {
      return doc.root.toObject();
    }
  } catch (e2) {}

  return doc.root || doc;
}

function normalizeHouseholdId(value) {
  if (value === null || value === undefined) return "";
  var s = String(value).trim();
  return (/^\d+$/).test(s) ? s : "";
}

function collectApplications(root) {
  if (!root) return [];

  // Split doc shape (single household per doc)
  if (root.application && (root.householdId || (root.application && (root.application.household || root.application.payload)))) {
    return [root.application];
  }

  // Some docs are direct Application-like objects
  if (root.payload && (root.payload.householdId || (root.payload.household && root.payload.household.householdId))) {
    return [root];
  }
  if (root.household && root.household.householdId) {
    return [root];
  }

  // Bulk doc shape: { Objects: [ application, application, ... ] }
  if (Array.isArray(root.Objects)) return root.Objects;
  if (Array.isArray(root.objects)) return root.objects;

  return [];
}

function getHouseholdFromApplication(app) {
  if (!app) return null;
  return app.household || (app.payload && app.payload.household) || app.payload || app;
}

function peekOne() {
  var results = cts.search(cts.collectionQuery(COLLECTION));
  var first = fn.head(results);
  if (!first) {
    return { error: "No docs found in collection", collection: COLLECTION, serviceVersion: SERVICE_VERSION };
  }

  var obj = docToObject(first);
  var sample = "";
  try {
    sample = JSON.stringify(obj);
  } catch (e) {
    sample = String(obj);
  }

  return {
    ok: true,
    serviceVersion: SERVICE_VERSION,
    collection: COLLECTION,
    uri: first.uri,
    topLevelKeys: (obj && typeof obj === "object") ? Object.keys(obj).slice(0, 40) : [],
    sample: sample.slice(0, 2000)
  };
}

/**
 * Find household applications in BOTH possible storage shapes:
 *  A) split docs: top-level householdId + application
 *  B) bulk docs: top-level Objects[] holding applications
 */
function findApplicationsByHouseholdId(householdId) {
  var hh = normalizeHouseholdId(householdId);
  if (!hh) return [];

  var out = [];

  // ---- A) Split docs: direct property householdId on the doc
  var splitQuery = cts.andQuery([
    cts.collectionQuery(COLLECTION),
    cts.jsonPropertyValueQuery("householdId", hh)
  ]);

  var splitDocs = cts.search(splitQuery).toArray();
  for (var i = 0; i < splitDocs.length; i++) {
    var obj = docToObject(splitDocs[i]);
    if (!obj) continue;

    if (obj.application) {
      out.push(obj.application);
    } else {
      // tolerate weird shapes
      var apps1 = collectApplications(obj);
      for (var a1 = 0; a1 < apps1.length; a1++) out.push(apps1[a1]);
    }
  }

  // ---- B) Bulk docs: householdId lives inside each application.household.householdId
  // We can only filter broadly at the doc level, so do a collection scan but stop early.
  // Since this is a demo with ~100, this is fine.
  if (out.length === 0) {
    var docs = cts.search(cts.collectionQuery(COLLECTION)).toArray();
    for (var d = 0; d < docs.length; d++) {
      var root = docToObject(docs[d]);
      var apps2 = collectApplications(root);
      for (var a2 = 0; a2 < apps2.length; a2++) {
        var hhObj = getHouseholdFromApplication(apps2[a2]);
        if (hhObj && hhObj.householdId !== null && hhObj.householdId !== undefined) {
          if (String(hhObj.householdId) === hh) {
            out.push(apps2[a2]);
          }
        }
      }
      if (out.length) break; // found in a bulk doc; good enough
    }
  }

  return out;
}

function getHousehold(householdId) {
  var hh = normalizeHouseholdId(householdId);
  if (!hh) {
    return { error: "Invalid householdId (digits only)", householdId: householdId, serviceVersion: SERVICE_VERSION };
  }

  var apps = findApplicationsByHouseholdId(hh);
  if (!apps.length) {
    return { error: "Household not found", householdId: hh, serviceVersion: SERVICE_VERSION };
  }

  // Return the household object (not the application) for convenience
  // If multiple apps returned (should not happen), return array
  if (apps.length === 1) {
    return getHouseholdFromApplication(apps[0]) || apps[0];
  }

  var households = [];
  for (var i = 0; i < apps.length; i++) households.push(getHouseholdFromApplication(apps[i]) || apps[i]);

  return { results: households, count: households.length, serviceVersion: SERVICE_VERSION };
}

function searchHouseholds() {
  var docs = cts.search(cts.collectionQuery(COLLECTION)).toArray();
  var households = [];

  for (var i = 0; i < docs.length; i++) {
    var root = docToObject(docs[i]);
    var apps = collectApplications(root);
    for (var a = 0; a < apps.length; a++) {
      var hh = getHouseholdFromApplication(apps[a]);
      if (hh) households.push(hh);
    }
  }

  return households;
}

function searchHouseholdsByQtext(qtext) {
  var q = (qtext === null || qtext === undefined) ? "" : String(qtext).trim();
  if (!q) return [];

  // If digits, try householdId fast-path
  var hh = normalizeHouseholdId(q);
  if (hh) {
    var apps = findApplicationsByHouseholdId(hh);
    var out = [];
    for (var i = 0; i < apps.length; i++) {
      var hhObj = getHouseholdFromApplication(apps[i]);
      if (hhObj) out.push(hhObj);
    }
    return out;
  }

  // Otherwise: broad search then filter down in JS
  var query = cts.andQuery([
    cts.collectionQuery(COLLECTION),
    cts.wordQuery(q, ["case-insensitive"])
  ]);

  var results = cts.search(query).toArray();
  var households = [];

  for (var i2 = 0; i2 < results.length; i2++) {
    var obj = docToObject(results[i2]);
    var apps2 = collectApplications(obj);
    for (var a2 = 0; a2 < apps2.length; a2++) {
      var hh2 = getHouseholdFromApplication(apps2[a2]);
      if (!hh2) continue;

      // heuristic: match familyName or any person last name
      if (hh2.familyName && String(hh2.familyName).toLowerCase() === q.toLowerCase()) {
        households.push(hh2);
        continue;
      }
      var persons = hh2.person || [];
      if (!Array.isArray(persons)) persons = persons ? [persons] : [];
      for (var p = 0; p < persons.length; p++) {
        var last = persons[p] && persons[p].last ? String(persons[p].last) : "";
        if (last && last.toLowerCase() === q.toLowerCase()) {
          households.push(hh2);
          break;
        }
      }
    }
  }

  return households;
}

exports.GET = function(context, params) {
  var action = (params && params.action !== null && params.action !== undefined) ? String(params.action) : "";

  if (action === "version") {
    return { ok: true, serviceVersion: SERVICE_VERSION, params: params };
  }

  if (action === "peek") {
    return peekOne();
  }

  if (action === "getHousehold") {
    return getHousehold(params ? params.householdId : null);
  }

  if (action === "searchHouseholds") {
    var results = searchHouseholds();
    return { results: results, count: results.length, serviceVersion: SERVICE_VERSION };
  }

  if (action === "searchHouseholdsByQtext") {
    var q = (params && params.q !== null && params.q !== undefined) ? String(params.q).trim() : "";
    var results2 = searchHouseholdsByQtext(q);
    return { results: results2, count: results2.length, serviceVersion: SERVICE_VERSION };
  }

  return { error: "Unsupported action", params: params, serviceVersion: SERVICE_VERSION };
};
