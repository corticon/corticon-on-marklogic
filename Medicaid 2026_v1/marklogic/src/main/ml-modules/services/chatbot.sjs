"use strict";

var lib = require("/ext/medicaidUiLib.sjs");

var SERVICE_VERSION = "chatbot-medicaid-ui-2026-02-24-b";
var DEFAULT_SCAN_LIMIT = 12000;
var US_STATES = [
  { abbr: "AL", name: "Alabama" }, { abbr: "AK", name: "Alaska" }, { abbr: "AZ", name: "Arizona" },
  { abbr: "AR", name: "Arkansas" }, { abbr: "CA", name: "California" }, { abbr: "CO", name: "Colorado" },
  { abbr: "CT", name: "Connecticut" }, { abbr: "DE", name: "Delaware" }, { abbr: "FL", name: "Florida" },
  { abbr: "GA", name: "Georgia" }, { abbr: "HI", name: "Hawaii" }, { abbr: "ID", name: "Idaho" },
  { abbr: "IL", name: "Illinois" }, { abbr: "IN", name: "Indiana" }, { abbr: "IA", name: "Iowa" },
  { abbr: "KS", name: "Kansas" }, { abbr: "KY", name: "Kentucky" }, { abbr: "LA", name: "Louisiana" },
  { abbr: "ME", name: "Maine" }, { abbr: "MD", name: "Maryland" }, { abbr: "MA", name: "Massachusetts" },
  { abbr: "MI", name: "Michigan" }, { abbr: "MN", name: "Minnesota" }, { abbr: "MS", name: "Mississippi" },
  { abbr: "MO", name: "Missouri" }, { abbr: "MT", name: "Montana" }, { abbr: "NE", name: "Nebraska" },
  { abbr: "NV", name: "Nevada" }, { abbr: "NH", name: "New Hampshire" }, { abbr: "NJ", name: "New Jersey" },
  { abbr: "NM", name: "New Mexico" }, { abbr: "NY", name: "New York" }, { abbr: "NC", name: "North Carolina" },
  { abbr: "ND", name: "North Dakota" }, { abbr: "OH", name: "Ohio" }, { abbr: "OK", name: "Oklahoma" },
  { abbr: "OR", name: "Oregon" }, { abbr: "PA", name: "Pennsylvania" }, { abbr: "RI", name: "Rhode Island" },
  { abbr: "SC", name: "South Carolina" }, { abbr: "SD", name: "South Dakota" }, { abbr: "TN", name: "Tennessee" },
  { abbr: "TX", name: "Texas" }, { abbr: "UT", name: "Utah" }, { abbr: "VT", name: "Vermont" },
  { abbr: "VA", name: "Virginia" }, { abbr: "WA", name: "Washington" }, { abbr: "WV", name: "West Virginia" },
  { abbr: "WI", name: "Wisconsin" }, { abbr: "WY", name: "Wyoming" }, { abbr: "DC", name: "District of Columbia" }
];

function onlyDeterminations(rows) {
  var out = [];
  rows = rows || [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (lib.hasValue(r.eligibility) || lib.hasValue(r.reason_code)) out.push(r);
  }
  return out;
}

function toArray(value) {
  return value instanceof Array ? value : (value ? [value] : []);
}

function readDocObject(uri) {
  if (!lib.hasValue(uri)) return null;
  try {
    var node = fn.head(fn.doc(String(uri)));
    if (!node) return null;
    if (node.root && typeof node.root.toObject === "function") return node.root.toObject();
    if (typeof node.toObject === "function") return node.toObject();
  } catch (e) {}
  return null;
}

function flattenDocDeterminations(docObj) {
  var rows = [];
  if (!docObj || !docObj.person) return rows;

  var people = toArray(docObj.person);
  for (var i = 0; i < people.length; i++) {
    var person = people[i] || {};
    var pathways = toArray(person.eligibilityPathway);
    for (var j = 0; j < pathways.length; j++) {
      var path = pathways[j] || {};
      var dets = toArray(path.determination);
      for (var k = 0; k < dets.length; k++) {
        var det = dets[k] || {};
        rows.push({
          personName: person.fullName || null,
          programCode: path.programCode || null,
          pathway: path.pathway || null,
          assignedPathwayType: path.assignedPathwayType || null,
          eligibility: det.eligibility || null,
          reasonCode: det.reasonCode || null
        });
      }
    }
  }
  return rows;
}

function chooseDocDeterminationMatch(summary, candidates) {
  var best = null;
  var bestScore = -1;
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i] || {};
    var score = 0;
    if (lib.equalsCI(c.eligibility, summary.eligibility)) score += 4;
    if (lib.equalsCI(c.reasonCode, summary.reasonCode)) score += 4;
    if (lib.hasValue(summary.programCode) && lib.equalsCI(c.programCode, summary.programCode)) score += 3;
    if (lib.hasValue(summary.pathway) && lib.equalsCI(c.pathway, summary.pathway)) score += 3;
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

function detectIntent(question) {
  var q = lib.normalizeLower(question);
  if (!q) return "help";
  if (looksLikeAnalyticsQuestion(question)) return "analytics";
  if (/(why|explain|reason|inelig|denied)/.test(q)) return "explain-determination";
  if (/(household|eligibility|program|pathway|determin)/.test(q)) return "determination-search";
  return "search";
}

function extractHouseholdId(question) {
  if (!question) return null;
  var m = String(question).match(/\bHH-\d+\b/i);
  return m ? m[0].toUpperCase() : null;
}

function extractPersonName(question) {
  if (!question) return null;
  var q = String(question);

  var m = q.match(/\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/);
  if (!m) return null;
  return { first: m[1], last: m[2], fullName: m[1] + " " + m[2] };
}

function extractFamilySurname(question) {
  if (!question) return null;
  var q = String(question);
  var m = q.match(/\b([A-Z][a-z]+)\s+family\b/);
  if (!m) return null;
  return m[1];
}

function lastNameOf(fullName) {
  if (!lib.hasValue(fullName)) return "";
  var parts = String(fullName).trim().split(/\s+/);
  return parts.length ? parts[parts.length - 1] : "";
}

function looksLikeAnalyticsQuestion(question) {
  var q = lib.normalizeLower(question);
  if (!q) return false;
  if (/(common|most|top|trend|across|cohort|geograph|statewide|population|analytics|dashboard)/.test(q)) return true;
  if (/(famil(?:y|ies).*(ineligible|eligible|coverage|pathway|state)|ineligible.*famil(?:y|ies)|by state|which state)/.test(q)) return true;
  if (extractStateReference(question, []) && /(inelig|eligible|reason|pathway|program|coverage|foster)/.test(q)) return true;
  return false;
}

function extractStateReference(question, datasetStateRows) {
  if (!question) return null;
  var q = String(question);
  var qLower = lib.normalizeLower(q);
  var i;
  var bestFullNameMatch = null;

  // Prefer the longest matching state name so "West Virginia" wins over "Virginia".
  for (i = 0; i < US_STATES.length; i++) {
    var st = US_STATES[i];
    var nameLower = lib.normalizeLower(st.name);
    if (qLower.indexOf(nameLower) < 0) continue;
    if (!bestFullNameMatch || st.name.length > bestFullNameMatch.name.length) {
      bestFullNameMatch = st;
    }
  }
  if (bestFullNameMatch) {
    return {
      requested: bestFullNameMatch.name,
      requestedAbbr: bestFullNameMatch.abbr,
      matched: findDatasetStateValue(bestFullNameMatch.name, bestFullNameMatch.abbr, datasetStateRows)
    };
  }

  var abbrMatches = q.match(/\b[A-Z]{2}\b/g) || [];
  for (i = 0; i < abbrMatches.length; i++) {
    var ab = String(abbrMatches[i]).toUpperCase();
    for (var j = 0; j < US_STATES.length; j++) {
      if (US_STATES[j].abbr === ab) {
        return {
          requested: US_STATES[j].name,
          requestedAbbr: ab,
          matched: findDatasetStateValue(US_STATES[j].name, ab, datasetStateRows)
        };
      }
    }
  }

  return null;
}

function findDatasetStateValue(fullName, abbr, datasetStateRows) {
  var i;
  datasetStateRows = datasetStateRows || [];
  for (i = 0; i < datasetStateRows.length; i++) {
    if (lib.equalsCI(datasetStateRows[i].value, fullName)) return datasetStateRows[i].value;
  }
  for (i = 0; i < datasetStateRows.length; i++) {
    if (lib.equalsCI(datasetStateRows[i].value, abbr)) return datasetStateRows[i].value;
  }
  return fullName || abbr || null;
}

function extractPathwayFilter(question) {
  var q = lib.normalizeLower(question);
  if (!q) return null;

  if (/foster\s+care|title\s*iv[- ]?e/.test(q)) {
    return {
      label: "Foster Care",
      keywords: ["foster", "iv-e", "title iv-e"]
    };
  }
  if (/chip\b|child health insurance/.test(q)) {
    return { label: "CHIP", keywords: ["chip", "child health"] };
  }
  if (/pregnan/.test(q)) {
    return { label: "Pregnancy", keywords: ["pregnan"] };
  }
  if (/medicare/.test(q)) {
    return { label: "Medicare", keywords: ["medicare"] };
  }
  if (/medicaid/.test(q)) {
    return { label: "Medicaid", keywords: ["medicaid"] };
  }
  if (/foster/.test(q)) {
    return { label: "Foster Care", keywords: ["foster"] };
  }

  return null;
}

function rowMatchesPathwayFilter(row, pathwayFilter) {
  if (!pathwayFilter || !pathwayFilter.keywords || !pathwayFilter.keywords.length) return true;
  var hay = lib.normalizeLower((row.program_code || "") + " " + (row.pathway || ""));
  for (var i = 0; i < pathwayFilter.keywords.length; i++) {
    if (hay.indexOf(lib.normalizeLower(pathwayFilter.keywords[i])) >= 0) return true;
  }
  return false;
}

function buildHouseholdIndex(caseRows) {
  var map = {};
  for (var i = 0; i < caseRows.length; i++) {
    map[String(caseRows[i].correlation_id)] = caseRows[i];
  }
  return map;
}

function summarizeDeterminations(rows, householdIndex, limit) {
  var out = [];
  var n = limit || 10;
  var docCache = {};
  for (var i = 0; i < rows.length && out.length < n; i++) {
    var r = rows[i];
    var h = householdIndex[String(r.correlation_id)] || {};
    var summary = {
      correlationId: r.correlation_id || null,
      householdId: r.household_id || null,
      state: r.household_state || null,
      personName: r.person_full_name || null,
      programCode: r.program_code || null,
      pathway: r.pathway || null,
      assignedPathwayType: r.assigned_pathway_type || null,
      eligibility: r.eligibility || null,
      reasonCode: r.reason_code || null,
      outputPayloadUri: h.output_payload_uri || null
    };

    if (lib.hasValue(summary.outputPayloadUri)) {
      var uri = String(summary.outputPayloadUri);
      if (!docCache[uri]) {
        docCache[uri] = flattenDocDeterminations(readDocObject(uri));
      }
      var match = chooseDocDeterminationMatch(summary, docCache[uri]);
      if (match) {
        if (!lib.hasValue(summary.personName)) summary.personName = match.personName;
        if (!lib.hasValue(summary.programCode)) summary.programCode = match.programCode;
        if (!lib.hasValue(summary.pathway)) summary.pathway = match.pathway;
        if (!lib.hasValue(summary.assignedPathwayType)) summary.assignedPathwayType = match.assignedPathwayType;
      }
    }

    out.push(summary);
  }
  return out;
}

function gatherMetricsForCorrelations(correlationIds, scanLimit) {
  var rows = [];
  var attr = lib.rowsFromView("corticon", "metrics_attribute_change", scanLimit);
  var assoc = lib.rowsFromView("corticon", "metrics_association_change", scanLimit);
  var entity = lib.rowsFromView("corticon", "metrics_entity_change", scanLimit);
  var allowed = {};
  for (var i = 0; i < correlationIds.length; i++) allowed[String(correlationIds[i])] = true;

  function pushMatching(inputRows, changeType) {
    for (var j = 0; j < inputRows.length; j++) {
      var r = inputRows[j];
      if (!allowed[String(r.correlation_id)]) continue;
      r.change_type = changeType;
      rows.push(r);
    }
  }

  pushMatching(attr, "attribute");
  pushMatching(assoc, "association");
  pushMatching(entity, "entity");
  return rows;
}

function topRuleInfluence(metricRows, limit) {
  var rulesheetMap = {};
  var hotspotMap = {};
  var n = limit || 15;
  for (var i = 0; i < metricRows.length; i++) {
    var r = metricRows[i];
    var sheet = r.rulesheet_name || "(null)";
    var rule = r.rule_number || "(null)";
    rulesheetMap[sheet] = (rulesheetMap[sheet] || 0) + 1;
    hotspotMap[sheet + " | rule " + rule] = (hotspotMap[sheet + " | rule " + rule] || 0) + 1;
  }
  return {
    topRulesheets: lib.mapToTopArray(rulesheetMap, n),
    topRuleHotspots: lib.mapToTopArray(hotspotMap, n)
  };
}

function findMatches(question, rows) {
  var q = lib.normalizeText(question);
  var qLower = lib.normalizeLower(question);
  var hh = extractHouseholdId(question);
  var person = extractPersonName(question);
  var familySurname = extractFamilySurname(question);
  var matches = [];

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var hit = false;

    if (hh && lib.equalsCI(r.household_id, hh)) hit = true;
    if (!hit && person && lib.containsCI(r.person_full_name, person.fullName)) hit = true;
    if (!hit && familySurname) {
      hit = lib.equalsCI(lastNameOf(r.person_full_name), familySurname) || lib.containsCI(r.person_full_name, familySurname);
    }
    if (!hit && q) {
      hit =
        lib.containsCI(r.household_id, qLower) ||
        lib.containsCI(r.correlation_id, qLower) ||
        lib.containsCI(r.household_state, qLower) ||
        lib.containsCI(r.person_full_name, qLower) ||
        lib.containsCI(r.program_code, qLower) ||
        lib.containsCI(r.pathway, qLower) ||
        lib.containsCI(r.eligibility, qLower) ||
        lib.containsCI(r.reason_code, qLower);
    }

    if (hit) matches.push(r);
  }

  return matches;
}

function docDeterminationsContainName(docRows, person, familySurname) {
  docRows = docRows || [];
  for (var i = 0; i < docRows.length; i++) {
    var name = docRows[i] && docRows[i].personName;
    if (person && lib.containsCI(name, person.fullName)) return true;
    if (familySurname && (lib.equalsCI(lastNameOf(name), familySurname) || lib.containsCI(name, familySurname))) return true;
  }
  return false;
}

function findMatchesByDocName(question, rows, householdIndex) {
  var person = extractPersonName(question);
  var familySurname = extractFamilySurname(question);
  if (!person && !familySurname) return [];

  var matches = [];
  var docCache = {};
  var uriNameHitCache = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var h = householdIndex[String(r.correlation_id)] || {};
    var uri = h.output_payload_uri ? String(h.output_payload_uri) : "";
    if (!uri) continue;

    if (uriNameHitCache[uri] === undefined) {
      if (!docCache[uri]) docCache[uri] = flattenDocDeterminations(readDocObject(uri));
      uriNameHitCache[uri] = docDeterminationsContainName(docCache[uri], person, familySurname);
    }

    if (uriNameHitCache[uri]) matches.push(r);
  }
  return matches;
}

function buildAnalyticsSnapshot(question, scanLimit) {
  var households = lib.rowsFromView("corticon", "household_case", scanLimit);
  var determinations = onlyDeterminations(lib.rowsFromView("corticon", "person_eligibility_determination", scanLimit * 5));
  var populations = lib.rowsFromView("corticon", "person_population", scanLimit * 5);
  var allIneligible = [];
  var i;

  for (i = 0; i < determinations.length; i++) {
    if (lib.equalsCI(determinations[i].eligibility, "Ineligible")) allIneligible.push(determinations[i]);
  }

  var states = lib.topCounts(households, "state", 60);
  var stateRef = extractStateReference(question, states);
  var stateFilter = stateRef && stateRef.matched ? stateRef.matched : "";
  var pathwayFilter = extractPathwayFilter(question);
  var ineligible = [];

  for (i = 0; i < allIneligible.length; i++) {
    var row = allIneligible[i];
    if (lib.hasValue(stateFilter) && !lib.equalsCI(row.household_state, stateFilter)) continue;
    if (!rowMatchesPathwayFilter(row, pathwayFilter)) continue;
    ineligible.push(row);
  }

  var popValues = [];
  for (i = 0; i < populations.length; i++) {
    if (lib.hasValue(stateFilter) && !lib.equalsCI(populations[i].household_state, stateFilter)) continue;
    popValues.push(populations[i].population_type);
  }

  return {
    requestedState: stateRef ? stateRef.requested : null,
    requestedStateAbbr: stateRef ? stateRef.requestedAbbr : null,
    stateFilter: stateFilter || null,
    requestedPathway: pathwayFilter ? pathwayFilter.label : null,
    householdCount: households.length,
    ineligibleDeterminationCount: ineligible.length,
    topStates: lib.topCounts(households, "state", 10),
    topIneligibilityReasons: lib.topCounts(ineligible, "reason_code", 15),
    topProgramsInIneligibleRows: lib.topCounts(ineligible, "program_code", 15),
    topPopulationTypes: lib.topCountsFromValues(popValues, 15)
  };
}

function answerForQuestion(question, params) {
  var scanLimit = lib.getIntParam(params, "scanLimit", DEFAULT_SCAN_LIMIT, 100, 60000);
  var matchLimit = lib.getIntParam(params, "limit", 10, 1, 100);
  var intent = detectIntent(question);

  if (intent === "analytics") {
    var analytics = buildAnalyticsSnapshot(question, scanLimit);
    var analyticsSummaryTarget = analytics.stateFilter ? analytics.stateFilter : (analytics.requestedState || "the current dataset");
    var responseDraft;
    if (analytics.ineligibleDeterminationCount === 0 && (analytics.stateFilter || analytics.requestedState || analytics.requestedPathway)) {
      responseDraft = "I did not find matching ineligible determinations for " + analyticsSummaryTarget +
        (analytics.requestedPathway ? (" and pathway/program filter '" + analytics.requestedPathway + "'") : "") +
        " in the current dataset.";
    } else {
      responseDraft = analytics.stateFilter ?
        ("Here are population/ineligibility patterns for " + analytics.stateFilter + ".") :
        "Here are population/ineligibility patterns across the current dataset.";
    }

    var summaryEndpoint = "/v1/resources/analytics?rs:action=summary";
    var reasonsEndpoint = "/v1/resources/analytics?rs:action=ineligibility-reasons";
    var geoEndpoint = "/v1/resources/analytics?rs:action=geographic-commonalities";
    if (analytics.stateFilter) {
      summaryEndpoint += "&rs:state=" + xdmp.urlEncode(analytics.stateFilter);
      reasonsEndpoint += "&rs:state=" + xdmp.urlEncode(analytics.stateFilter);
      geoEndpoint += "&rs:state=" + xdmp.urlEncode(analytics.stateFilter);
    }

    return {
      ok: true,
      serviceVersion: SERVICE_VERSION,
      intent: intent,
      responseDraft: responseDraft,
      analytics: analytics,
      suggestedActions: [
        { action: "openManagementView", endpoint: summaryEndpoint },
        { action: "topIneligibilityReasons", endpoint: reasonsEndpoint },
        { action: "geoCommonalities", endpoint: geoEndpoint }
      ],
      citations: []
    };
  }

  var determinations = onlyDeterminations(lib.rowsFromView("corticon", "person_eligibility_determination", scanLimit * 5));
  var households = lib.rowsFromView("corticon", "household_case", scanLimit);
  var householdIndex = buildHouseholdIndex(households);
  var matches = findMatches(question, determinations);
  if (!matches.length && (extractPersonName(question) || extractFamilySurname(question))) {
    matches = findMatchesByDocName(question, determinations, householdIndex);
  }
  if (!matches.length && looksLikeAnalyticsQuestion(question)) {
    var fallbackAnalytics = buildAnalyticsSnapshot(question, scanLimit);
    return {
      ok: true,
      serviceVersion: SERVICE_VERSION,
      intent: "analytics",
      query: question,
      responseDraft: fallbackAnalytics.ineligibleDeterminationCount === 0 ?
        "I treated this as an analytics question, but no matching rows were found for the requested filters in the current dataset." :
        "I treated this as an analytics question and returned population/ineligibility patterns.",
      analytics: fallbackAnalytics,
      suggestedActions: [
        { action: "openManagementView", endpoint: "/v1/resources/analytics?rs:action=summary" },
        { action: "topIneligibilityReasons", endpoint: "/v1/resources/analytics?rs:action=ineligibility-reasons" },
        { action: "geoCommonalities", endpoint: "/v1/resources/analytics?rs:action=geographic-commonalities" }
      ],
      citations: []
    };
  }
  if (intent === "explain-determination" && /(inelig|denied|not eligible)/i.test(String(question || ""))) {
    var narrowed = [];
    for (var m = 0; m < matches.length; m++) {
      if (lib.equalsCI(matches[m].eligibility, "Ineligible")) narrowed.push(matches[m]);
    }
    if (narrowed.length) matches = narrowed;
  }
  lib.sortRows(matches, "household_id", "asc");

  var summarized = summarizeDeterminations(matches, householdIndex, matchLimit);
  var citationMap = {};
  for (var i = 0; i < summarized.length; i++) {
    var uri = summarized[i].outputPayloadUri;
    if (uri) citationMap[uri] = true;
  }

  var citations = [];
  var citationUris = Object.keys(citationMap);
  for (i = 0; i < citationUris.length; i++) {
    citations.push({ citationId: citationUris[i], citationLabel: citationUris[i] });
  }

  var responseDraft;
  if (!summarized.length) {
    responseDraft = "I could not find matching eligibility determinations in the current output collection. Try a household ID (for example HH-12), a person name, a program code, or a reason code.";
  } else if (intent === "explain-determination") {
    var corrs = [];
    var corrSeen = {};
    for (i = 0; i < summarized.length; i++) {
      var c = summarized[i].correlationId;
      if (c && !corrSeen[c]) {
        corrSeen[c] = true;
        corrs.push(c);
      }
    }
    var metricRows = gatherMetricsForCorrelations(corrs, scanLimit * 20);
    var ruleInfluence = topRuleInfluence(metricRows, 10);

    responseDraft = "I found matching determinations and included the most frequent rulesheets/rule hotspots from Corticon trace metrics for those cases.";
    return {
      ok: true,
      serviceVersion: SERVICE_VERSION,
      intent: intent,
      query: question,
      matchCount: matches.length,
      matches: summarized,
      ruleInfluence: ruleInfluence,
      suggestedActions: [
        { action: "openDeterminationsView", endpoint: "/v1/resources/eligibilityDeterminations" },
        { action: "openAnalyticsRulesByProgram", endpoint: "/v1/resources/analytics?rs:action=rules-by-program" }
      ],
      responseDraft: responseDraft,
      citations: citations
    };
  } else {
    responseDraft = "I found matching eligibility determinations. Use the determinations view for faceted filtering, or ask a follow-up such as 'why was HH-12 ineligible?'";
  }

  return {
    ok: true,
    serviceVersion: SERVICE_VERSION,
    intent: intent,
    query: question,
    matchCount: matches.length,
    matches: summarized,
    suggestedActions: [
      { action: "openDeterminationsView", endpoint: "/v1/resources/eligibilityDeterminations" },
      { action: "openManagementView", endpoint: "/v1/resources/analytics?rs:action=summary" }
    ],
    responseDraft: responseDraft,
    citations: citations
  };
}

exports.GET = function (context, params) {
  context.outputTypes = ["application/json"];
  var question = lib.getParam(params, "q", "");
  if (!lib.hasValue(question)) {
    return {
      ok: true,
      serviceVersion: SERVICE_VERSION,
      intent: "help",
      responseDraft: "POST JSON {\"query\":\"...\"} to this resource to retrieve case-level determinations and analytics context for a support chatbot UI.",
      supportedIntents: ["determination-search", "explain-determination", "analytics"],
      endpoints: {
        determinations: "/v1/resources/eligibilityDeterminations",
        analytics: "/v1/resources/analytics",
        chatbot: "/v1/resources/chatbot"
      }
    };
  }
  try {
    return answerForQuestion(question, params || {});
  } catch (e) {
    return { ok: false, serviceVersion: SERVICE_VERSION, error: e.message, stack: e.stack };
  }
};

exports.POST = function (context, params, input) {
  context.outputTypes = ["application/json"];
  try {
    var body = lib.parseJsonBody(input);
    var question = body.query || body.question || body.prompt || "";
    if (!lib.hasValue(question)) {
      return lib.badRequest("chatbot POST requires JSON body with 'query' (or 'question'/'prompt')", {
        serviceVersion: SERVICE_VERSION
      });
    }
    return answerForQuestion(question, params || {});
  } catch (e) {
    return { ok: false, serviceVersion: SERVICE_VERSION, error: e.message, stack: e.stack };
  }
};
