"use strict";

var lib = require("/ext/medicaidUiLib.sjs");

var SERVICE_VERSION = "analytics-medicaid-ui-2026-02-23-a";
var DEFAULT_SCAN_LIMIT = 15000;

function onlyDeterminations(rows) {
  var out = [];
  rows = rows || [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (lib.hasValue(r.eligibility) || lib.hasValue(r.reason_code)) out.push(r);
  }
  return out;
}

function topN(params, fallback, maxValue) {
  return lib.getIntParam(params, "limit", fallback || 20, 1, maxValue || 500);
}

function readCoreRows(scanLimit) {
  return {
    households: lib.rowsFromView("corticon", "household_case", scanLimit),
    persons: lib.rowsFromView("corticon", "person", scanLimit * 3),
    populations: lib.rowsFromView("corticon", "person_population", scanLimit * 5),
    pathways: lib.rowsFromView("corticon", "person_eligibility_pathway", scanLimit * 8),
    determinations: onlyDeterminations(lib.rowsFromView("corticon", "person_eligibility_determination", scanLimit * 8))
  };
}

function readMetricRows(scanLimit) {
  var attr = lib.rowsFromView("corticon", "metrics_attribute_change", scanLimit * 20);
  var assoc = lib.rowsFromView("corticon", "metrics_association_change", scanLimit * 20);
  var entity = lib.rowsFromView("corticon", "metrics_entity_change", scanLimit * 20);

  var rows = [];
  var i;
  for (i = 0; i < attr.length; i++) {
    attr[i].change_type = "attribute";
    rows.push(attr[i]);
  }
  for (i = 0; i < assoc.length; i++) {
    assoc[i].change_type = "association";
    assoc[i].entity_name = assoc[i].source_entity_name || assoc[i].target_entity_name || null;
    rows.push(assoc[i]);
  }
  for (i = 0; i < entity.length; i++) {
    entity[i].change_type = "entity";
    rows.push(entity[i]);
  }
  return rows;
}

function rowPassesDeterminationFilters(row, filters, populationIndex) {
  if (!row) return false;
  if (!lib.equalsCI(row.household_state, filters.state)) return false;
  if (!lib.equalsCI(row.program_code, filters.programCode)) return false;
  if (!lib.equalsCI(row.assigned_pathway_type, filters.assignedPathwayType)) return false;
  if (!lib.equalsCI(row.eligibility, filters.eligibility)) return false;
  if (!lib.equalsCI(row.reason_code, filters.reasonCode)) return false;

  if (lib.hasValue(filters.populationType)) {
    var key = lib.makePersonKey(row.correlation_id, row.household_id, row.person_full_name);
    var pops = populationIndex[key] || [];
    var matched = false;
    for (var i = 0; i < pops.length; i++) {
      if (lib.equalsCI(pops[i], filters.populationType)) {
        matched = true;
        break;
      }
    }
    if (!matched) return false;
  }

  return true;
}

function filtersFromParams(params) {
  return {
    state: lib.getParam(params, "state", ""),
    populationType: lib.getParam(params, "populationType", ""),
    programCode: lib.getParam(params, "programCode", ""),
    assignedPathwayType: lib.getParam(params, "assignedPathwayType", ""),
    eligibility: lib.getParam(params, "eligibility", ""),
    reasonCode: lib.getParam(params, "reasonCode", "")
  };
}

function keyMapFromRows(rows, field) {
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    map[String(row[field])] = row;
  }
  return map;
}

function filteredDeterminations(core, filters, populationIndex) {
  var rows = [];
  for (var i = 0; i < core.determinations.length; i++) {
    if (rowPassesDeterminationFilters(core.determinations[i], filters, populationIndex)) {
      rows.push(core.determinations[i]);
    }
  }
  return rows;
}

function correlationSetFromDeterminations(rows) {
  var out = {};
  for (var i = 0; i < rows.length; i++) {
    out[String(rows[i].correlation_id)] = true;
  }
  return out;
}

function filterRowsByCorrelation(rows, correlationSet, allowAllWhenEmpty) {
  if (allowAllWhenEmpty && !Object.keys(correlationSet || {}).length) return rows.slice(0);
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    if (correlationSet[String(rows[i].correlation_id)]) out.push(rows[i]);
  }
  return out;
}

function rulesheetArraysFromMetricRows(metricRows) {
  var rulesheetValues = [];
  var ruleHotspotValues = [];
  for (var i = 0; i < metricRows.length; i++) {
    var mr = metricRows[i];
    var rulesheet = mr.rulesheet_name || "(null)";
    var ruleNo = mr.rule_number || "(null)";
    rulesheetValues.push(rulesheet);
    ruleHotspotValues.push(rulesheet + " | rule " + ruleNo);
  }
  return {
    rulesheetValues: rulesheetValues,
    ruleHotspotValues: ruleHotspotValues
  };
}

function buildSummaryPayload(core, metricRows, filters, populationIndex, limit) {
  var filteredDets = filteredDeterminations(core, filters, populationIndex);
  var corrSet = correlationSetFromDeterminations(filteredDets);
  var filteredHouseholds = filterRowsByCorrelation(core.households, corrSet, true);
  var metricRowsFiltered = filterRowsByCorrelation(metricRows, corrSet, true);
  var ruleArrays = rulesheetArraysFromMetricRows(metricRowsFiltered);

  var personPopulationValues = [];
  for (var i = 0; i < core.populations.length; i++) {
    var p = core.populations[i];
    if (lib.hasValue(filters.state) && !lib.equalsCI(p.household_state, filters.state)) continue;
    personPopulationValues.push(p.population_type);
  }

  return {
    filteredDeterminations: filteredDets,
    filteredHouseholds: filteredHouseholds,
    metricRowsFiltered: metricRowsFiltered,
    payload: {
      ok: true,
      serviceVersion: SERVICE_VERSION,
      action: "summary",
      filters: filters,
      rowCounts: {
        households: core.households.length,
        persons: core.persons.length,
        populations: core.populations.length,
        pathways: core.pathways.length,
        determinations: core.determinations.length,
        metrics: metricRows.length
      },
      filteredCounts: {
        households: filteredHouseholds.length,
        determinations: filteredDets.length,
        metrics: metricRowsFiltered.length
      },
      summary: {
        householdsByState: lib.topCounts(filteredHouseholds, "state", limit),
        householdsByStatus: lib.topCounts(filteredHouseholds, "corticon_status", 10),
        personPopulationTop: lib.topCountsFromValues(personPopulationValues, limit),
        programCodeTop: lib.topCounts(filteredDets, "program_code", limit),
        assignedPathwayTypeTop: lib.topCounts(filteredDets, "assigned_pathway_type", 10),
        eligibilityTop: lib.topCounts(filteredDets, "eligibility", 10),
        reasonCodeTop: lib.topCounts(filteredDets, "reason_code", limit),
        rulesheetTop: lib.topCountsFromValues(ruleArrays.rulesheetValues, limit),
        ruleHotspotTop: lib.topCountsFromValues(ruleArrays.ruleHotspotValues, limit)
      }
    }
  };
}

function buildIneligibilityReasonsPayload(core, filters, populationIndex, limit) {
  var reasonFilters = {
    state: filters.state,
    populationType: filters.populationType,
    programCode: filters.programCode,
    assignedPathwayType: filters.assignedPathwayType,
    eligibility: lib.hasValue(filters.eligibility) ? filters.eligibility : "Ineligible",
    reasonCode: filters.reasonCode
  };

  var rows = [];
  for (var i = 0; i < core.determinations.length; i++) {
    if (rowPassesDeterminationFilters(core.determinations[i], reasonFilters, populationIndex)) rows.push(core.determinations[i]);
  }

  var byStateReasonMap = {};
  for (i = 0; i < rows.length; i++) {
    var key = (rows[i].household_state || "(null)") + " | " + (rows[i].reason_code || "(null)");
    byStateReasonMap[key] = (byStateReasonMap[key] || 0) + 1;
  }

  return {
    ok: true,
    serviceVersion: SERVICE_VERSION,
    action: "ineligibility-reasons",
    filters: reasonFilters,
    totalRows: rows.length,
    topReasons: lib.topCounts(rows, "reason_code", limit),
    topStateReasonPairs: lib.mapToTopArray(byStateReasonMap, limit)
  };
}

function buildGeographicPayload(core, filters, populationIndex, limit) {
  var detRows = [];
  for (var i = 0; i < core.determinations.length; i++) {
    if (rowPassesDeterminationFilters(core.determinations[i], filters, populationIndex)) detRows.push(core.determinations[i]);
  }

  var stateProgram = {};
  var stateReason = {};
  var stateEligibility = {};
  for (i = 0; i < detRows.length; i++) {
    var s = detRows[i].household_state || "(null)";
    var p = detRows[i].program_code || "(null)";
    var r = detRows[i].reason_code || "(null)";
    var e = detRows[i].eligibility || "(null)";
    stateProgram[s + " | " + p] = (stateProgram[s + " | " + p] || 0) + 1;
    stateReason[s + " | " + r] = (stateReason[s + " | " + r] || 0) + 1;
    stateEligibility[s + " | " + e] = (stateEligibility[s + " | " + e] || 0) + 1;
  }

  return {
    ok: true,
    serviceVersion: SERVICE_VERSION,
    action: "geographic-commonalities",
    filters: filters,
    totalRows: detRows.length,
    householdsByState: lib.topCounts(core.households, "state", limit),
    determinationsByState: lib.topCounts(detRows, "household_state", limit),
    topStateProgramPairs: lib.mapToTopArray(stateProgram, limit),
    topStateReasonPairs: lib.mapToTopArray(stateReason, limit),
    topStateEligibilityPairs: lib.mapToTopArray(stateEligibility, limit)
  };
}

function buildCohortPayload(core, params, limit) {
  var stateFilter = lib.getParam(params, "state", "");
  var populationRows = core.populations;
  if (lib.hasValue(stateFilter)) {
    var filteredPopulationRows = [];
    for (var i = 0; i < populationRows.length; i++) {
      if (lib.equalsCI(populationRows[i].household_state, stateFilter)) filteredPopulationRows.push(populationRows[i]);
    }
    populationRows = filteredPopulationRows;
  }

  var populationState = {};
  var populationAge = {};
  var personRows = core.persons;
  var personIndex = {};
  for (i = 0; i < personRows.length; i++) {
    personIndex[lib.makePersonKey(personRows[i].correlation_id, personRows[i].household_id, personRows[i].full_name)] = personRows[i];
  }

  for (i = 0; i < populationRows.length; i++) {
    var pr = populationRows[i];
    var key = lib.makePersonKey(pr.correlation_id, pr.household_id, pr.person_full_name);
    var person = personIndex[key] || {};
    var popType = pr.population_type || "(null)";
    var stateVal = pr.household_state || "(null)";
    var ageCategory = person.age_category || "(unknown)";
    populationState[popType + " | " + stateVal] = (populationState[popType + " | " + stateVal] || 0) + 1;
    populationAge[popType + " | " + ageCategory] = (populationAge[popType + " | " + ageCategory] || 0) + 1;
  }

  return {
    ok: true,
    serviceVersion: SERVICE_VERSION,
    action: "cohort-commonalities",
    filters: { state: stateFilter },
    topPopulationTypes: lib.topCounts(populationRows, "population_type", limit),
    topPopulationByState: lib.mapToTopArray(populationState, limit),
    topPopulationByAgeCategory: lib.mapToTopArray(populationAge, limit)
  };
}

function buildRulesByProgramPayload(pathways, metrics, programFilter, limit) {
  var rulesByCorrelation = {};
  for (var i = 0; i < metrics.length; i++) {
    var corr = String(metrics[i].correlation_id || "");
    if (!corr) continue;
    if (!rulesByCorrelation[corr]) rulesByCorrelation[corr] = {};
    var rs = metrics[i].rulesheet_name || "(null)";
    rulesByCorrelation[corr][rs] = true;
  }

  var programRules = {};
  for (i = 0; i < pathways.length; i++) {
    var p = pathways[i];
    if (!lib.equalsCI(p.program_code, programFilter)) continue;
    var corrId = String(p.correlation_id || "");
    var rsMap = rulesByCorrelation[corrId] || {};
    var ruleNames = Object.keys(rsMap);
    var program = p.program_code || "(null)";
    for (var j = 0; j < ruleNames.length; j++) {
      var key = program + " | " + ruleNames[j];
      programRules[key] = (programRules[key] || 0) + 1;
    }
  }

  return {
    ok: true,
    serviceVersion: SERVICE_VERSION,
    action: "rules-by-program",
    filters: { programCode: programFilter },
    topProgramRulesheetPairs: lib.mapToTopArray(programRules, limit)
  };
}

function dashboardAction(params) {
  var scanLimit = lib.getIntParam(params, "scanLimit", DEFAULT_SCAN_LIMIT, 100, 75000);
  var summaryLimit = lib.getIntParam(params, "summaryLimit", topN(params, 25, 500), 1, 500);
  var listLimit = lib.getIntParam(params, "limit", 100, 1, 1000);
  var filters = filtersFromParams(params);
  var t0 = (new Date()).getTime();

  var core = readCoreRows(scanLimit);
  var t1 = (new Date()).getTime();
  var metricRows = readMetricRows(scanLimit);
  var t2 = (new Date()).getTime();
  var populationIndex = lib.buildPopulationIndex(core.populations);
  var summary = buildSummaryPayload(core, metricRows, filters, populationIndex, summaryLimit).payload;
  var reasons = buildIneligibilityReasonsPayload(core, filters, populationIndex, listLimit);
  var geo = buildGeographicPayload(core, filters, populationIndex, listLimit);
  var cohort = buildCohortPayload(core, params, listLimit);
  var rules = buildRulesByProgramPayload(core.pathways, metricRows, lib.getParam(params, "programCode", ""), listLimit);
  var t3 = (new Date()).getTime();

  return {
    ok: true,
    serviceVersion: SERVICE_VERSION,
    action: "dashboard",
    filters: filters,
    scanLimit: scanLimit,
    summary: summary,
    reasons: reasons,
    geo: geo,
    cohort: cohort,
    rules: rules,
    diagnostics: {
      readCoreMs: t1 - t0,
      readMetricsMs: t2 - t1,
      aggregateMs: t3 - t2,
      totalMs: t3 - t0
    }
  };
}

function summaryAction(params) {
  var scanLimit = lib.getIntParam(params, "scanLimit", DEFAULT_SCAN_LIMIT, 100, 75000);
  var n = topN(params, 25, 500);
  var core = readCoreRows(scanLimit);
  var metricRows = readMetricRows(scanLimit);
  var populationIndex = lib.buildPopulationIndex(core.populations);
  var filters = filtersFromParams(params);
  var summaryResult = buildSummaryPayload(core, metricRows, filters, populationIndex, n).payload;
  summaryResult.scanLimit = scanLimit;
  return summaryResult;
}

function ineligibilityReasonsAction(params) {
  var scanLimit = lib.getIntParam(params, "scanLimit", DEFAULT_SCAN_LIMIT, 100, 75000);
  var n = topN(params, 100, 1000);
  var core = readCoreRows(scanLimit);
  var populationIndex = lib.buildPopulationIndex(core.populations);
  var filters = filtersFromParams(params);
  if (!lib.hasValue(filters.eligibility)) filters.eligibility = "Ineligible";

  var rows = [];
  for (var i = 0; i < core.determinations.length; i++) {
    if (rowPassesDeterminationFilters(core.determinations[i], filters, populationIndex)) {
      rows.push(core.determinations[i]);
    }
  }

  var byReason = lib.topCounts(rows, "reason_code", n);
  var byStateReasonMap = {};
  for (i = 0; i < rows.length; i++) {
    var key = (rows[i].household_state || "(null)") + " | " + (rows[i].reason_code || "(null)");
    byStateReasonMap[key] = (byStateReasonMap[key] || 0) + 1;
  }

  return {
    ok: true,
    serviceVersion: SERVICE_VERSION,
    action: "ineligibility-reasons",
    filters: filters,
    totalRows: rows.length,
    topReasons: byReason,
    topStateReasonPairs: lib.mapToTopArray(byStateReasonMap, n)
  };
}

function geographicCommonalitiesAction(params) {
  var scanLimit = lib.getIntParam(params, "scanLimit", DEFAULT_SCAN_LIMIT, 100, 75000);
  var n = topN(params, 100, 1000);
  var core = readCoreRows(scanLimit);
  var populationIndex = lib.buildPopulationIndex(core.populations);
  var filters = filtersFromParams(params);

  var detRows = [];
  for (var i = 0; i < core.determinations.length; i++) {
    if (rowPassesDeterminationFilters(core.determinations[i], filters, populationIndex)) detRows.push(core.determinations[i]);
  }

  var stateProgram = {};
  var stateReason = {};
  var stateEligibility = {};
  for (i = 0; i < detRows.length; i++) {
    var s = detRows[i].household_state || "(null)";
    var p = detRows[i].program_code || "(null)";
    var r = detRows[i].reason_code || "(null)";
    var e = detRows[i].eligibility || "(null)";
    stateProgram[s + " | " + p] = (stateProgram[s + " | " + p] || 0) + 1;
    stateReason[s + " | " + r] = (stateReason[s + " | " + r] || 0) + 1;
    stateEligibility[s + " | " + e] = (stateEligibility[s + " | " + e] || 0) + 1;
  }

  return {
    ok: true,
    serviceVersion: SERVICE_VERSION,
    action: "geographic-commonalities",
    filters: filters,
    totalRows: detRows.length,
    householdsByState: lib.topCounts(core.households, "state", n),
    determinationsByState: lib.topCounts(detRows, "household_state", n),
    topStateProgramPairs: lib.mapToTopArray(stateProgram, n),
    topStateReasonPairs: lib.mapToTopArray(stateReason, n),
    topStateEligibilityPairs: lib.mapToTopArray(stateEligibility, n)
  };
}

function cohortCommonalitiesAction(params) {
  var scanLimit = lib.getIntParam(params, "scanLimit", DEFAULT_SCAN_LIMIT, 100, 75000);
  var n = topN(params, 100, 1000);
  var core = readCoreRows(scanLimit);

  var populationRows = core.populations;
  if (lib.hasValue(lib.getParam(params, "state", ""))) {
    var state = lib.getParam(params, "state", "");
    var filteredPopulationRows = [];
    for (var i = 0; i < populationRows.length; i++) {
      if (lib.equalsCI(populationRows[i].household_state, state)) filteredPopulationRows.push(populationRows[i]);
    }
    populationRows = filteredPopulationRows;
  }

  var populationState = {};
  var populationAge = {};
  var personRows = core.persons;
  var personIndex = {};
  for (i = 0; i < personRows.length; i++) {
    personIndex[lib.makePersonKey(personRows[i].correlation_id, personRows[i].household_id, personRows[i].full_name)] = personRows[i];
  }

  for (i = 0; i < populationRows.length; i++) {
    var pr = populationRows[i];
    var key = lib.makePersonKey(pr.correlation_id, pr.household_id, pr.person_full_name);
    var person = personIndex[key] || {};
    var popType = pr.population_type || "(null)";
    var stateVal = pr.household_state || "(null)";
    var ageCategory = person.age_category || "(unknown)";
    populationState[popType + " | " + stateVal] = (populationState[popType + " | " + stateVal] || 0) + 1;
    populationAge[popType + " | " + ageCategory] = (populationAge[popType + " | " + ageCategory] || 0) + 1;
  }

  return {
    ok: true,
    serviceVersion: SERVICE_VERSION,
    action: "cohort-commonalities",
    filters: { state: lib.getParam(params, "state", "") },
    topPopulationTypes: lib.topCounts(populationRows, "population_type", n),
    topPopulationByState: lib.mapToTopArray(populationState, n),
    topPopulationByAgeCategory: lib.mapToTopArray(populationAge, n)
  };
}

function rulesByProgramAction(params) {
  var scanLimit = lib.getIntParam(params, "scanLimit", DEFAULT_SCAN_LIMIT, 100, 75000);
  var n = topN(params, 100, 1000);
  var programFilter = lib.getParam(params, "programCode", "");
  var pathways = lib.rowsFromView("corticon", "person_eligibility_pathway", scanLimit * 8);
  var metrics = readMetricRows(scanLimit);

  var rulesByCorrelation = {};
  for (var i = 0; i < metrics.length; i++) {
    var corr = String(metrics[i].correlation_id || "");
    if (!corr) continue;
    if (!rulesByCorrelation[corr]) rulesByCorrelation[corr] = {};
    var rs = metrics[i].rulesheet_name || "(null)";
    rulesByCorrelation[corr][rs] = true;
  }

  var programRules = {};
  for (i = 0; i < pathways.length; i++) {
    var p = pathways[i];
    if (!lib.equalsCI(p.program_code, programFilter)) continue;
    var corrId = String(p.correlation_id || "");
    var rsMap = rulesByCorrelation[corrId] || {};
    var ruleNames = Object.keys(rsMap);
    var program = p.program_code || "(null)";
    for (var j = 0; j < ruleNames.length; j++) {
      var key = program + " | " + ruleNames[j];
      programRules[key] = (programRules[key] || 0) + 1;
    }
  }

  return {
    ok: true,
    serviceVersion: SERVICE_VERSION,
    action: "rules-by-program",
    filters: { programCode: programFilter },
    topProgramRulesheetPairs: lib.mapToTopArray(programRules, n)
  };
}

function getAction(params) {
  return String(lib.getParam(params, "action", "summary"));
}

exports.GET = function (context, params) {
  context.outputTypes = ["application/json"];
  try {
    params = params || {};
    var action = getAction(params);

    if (action === "dashboard") return dashboardAction(params);
    if (action === "summary") return summaryAction(params);
    if (action === "ineligibility-reasons") return ineligibilityReasonsAction(params);
    if (action === "geographic-commonalities") return geographicCommonalitiesAction(params);
    if (action === "cohort-commonalities") return cohortCommonalitiesAction(params);
    if (action === "rules-by-program") return rulesByProgramAction(params);

    return lib.badRequest(
      "Unsupported rs:action for analytics. Try: dashboard, summary, ineligibility-reasons, geographic-commonalities, cohort-commonalities, rules-by-program",
      { ok: false, serviceVersion: SERVICE_VERSION, action: action }
    );
  } catch (e) {
    return {
      ok: false,
      serviceVersion: SERVICE_VERSION,
      error: e.message,
      stack: e.stack
    };
  }
};
