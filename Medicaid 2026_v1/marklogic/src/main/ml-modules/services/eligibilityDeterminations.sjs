"use strict";

var lib = require("/ext/medicaidUiLib.sjs");

var SERVICE_VERSION = "eligibilityDeterminations-2026-02-23-a";
var DEFAULT_SCAN_LIMIT = 10000;

function buildFilters(params) {
  return {
    q: lib.getParam(params, "q", ""),
    householdId: lib.getParam(params, "householdId", ""),
    correlationId: lib.getParam(params, "correlationId", ""),
    state: lib.getParam(params, "state", ""),
    personName: lib.getParam(params, "personName", ""),
    programCode: lib.getParam(params, "programCode", ""),
    pathway: lib.getParam(params, "pathway", ""),
    assignedPathwayType: lib.getParam(params, "assignedPathwayType", ""),
    eligibility: lib.getParam(params, "eligibility", ""),
    reasonCode: lib.getParam(params, "reasonCode", ""),
    populationType: lib.getParam(params, "populationType", ""),
    sex: lib.getParam(params, "sex", ""),
    maritalStatus: lib.getParam(params, "maritalStatus", ""),
    ageCategory: lib.getParam(params, "ageCategory", ""),
    relationToPolicyholder: lib.getParam(params, "relationToPolicyholder", ""),
    isParentOrCaretaker: lib.getParam(params, "isParentOrCaretaker", ""),
    hasDependentChild: lib.getParam(params, "hasDependentChild", ""),
    isMarried: lib.getParam(params, "isMarried", ""),
    minAge: lib.getParam(params, "minAge", ""),
    maxAge: lib.getParam(params, "maxAge", "")
  };
}

function parseOptionalNumber(value) {
  if (!lib.hasValue(value)) return null;
  var n = Number(value);
  return isNaN(n) ? null : n;
}

function parseOptionalBool(value) {
  if (!lib.hasValue(value)) return null;
  var s = String(value).toLowerCase();
  if (s === "true" || s === "1" || s === "yes" || s === "y") return true;
  if (s === "false" || s === "0" || s === "no" || s === "n") return false;
  return null;
}

function boolMatches(actualValue, expectedValue) {
  var expected = parseOptionalBool(expectedValue);
  if (expected === null) return true;
  return Boolean(actualValue) === expected;
}

function normalizeMaritalStatus(value) {
  return lib.hasValue(value) ? String(value).toLowerCase() : "";
}

function isMarriedStatus(value) {
  var s = normalizeMaritalStatus(value);
  if (!s) return false;
  if (s.indexOf("never married") >= 0) return false;
  return s.indexOf("married") >= 0;
}

function copyRow(row) {
  var copy = {};
  var keys = Object.keys(row || {});
  for (var i = 0; i < keys.length; i++) copy[keys[i]] = row[keys[i]];
  return copy;
}

function toArray(value) {
  return value instanceof Array ? value : (value ? [value] : []);
}

function isDeterminationRow(row) {
  return !!(row && (lib.hasValue(row.eligibility) || lib.hasValue(row.reason_code)));
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
      var determinations = toArray(path.determination);
      for (var k = 0; k < determinations.length; k++) {
        var det = determinations[k] || {};
        rows.push({
          person_full_name: person.fullName || null,
          person_sex: person.sex || null,
          person_age: person.age !== undefined ? person.age : null,
          person_age_category: person.ageCategory || null,
          person_marital_status: person.maritalStatus || null,
          person_relation_to_policyholder: person.relationToPolicyholder || null,
          person_caretaker_relationship: person.caretakerRelationship || null,
          person_files_as: person.filesAs || null,
          person_filing_status: person.filingStatus || null,
          person_citizenship_status: person.citizenshipStatus || null,
          person_current_residence_state: person.currentResidenceState || null,
          person_is_parent_or_caretaker: person.isParentOrCaretaker === true,
          person_has_dependent_child: person.hasDependentChild === true,
          person_presently_uninsured: person.presentlyUninsured === true,
          person_has_access_to_public_employee_coverage: person.hasAccessToPublicEmployeeCoverage === true,
          person_household_size: person.householdSize !== undefined ? person.householdSize : null,
          household_magi_income_pct_fpl: person.householdMagiIncomePctFPL !== undefined ? person.householdMagiIncomePctFPL : null,
          household_resources: person.householdResources !== undefined ? person.householdResources : null,
          pathway: path.pathway || null,
          program_code: path.programCode || null,
          assigned_pathway_type: path.assignedPathwayType || null,
          eligibility: det.eligibility || null,
          reason_code: det.reasonCode || null
        });
      }
    }
  }
  return rows;
}

function scoreEnrichmentMatch(target, candidate) {
  var score = 0;
  if (!candidate) return -1;
  if (lib.hasValue(target.person_full_name) && lib.equalsCI(candidate.person_full_name, target.person_full_name)) score += 7;
  if (lib.equalsCI(candidate.eligibility, target.eligibility)) score += 4;
  if (lib.equalsCI(candidate.reason_code, target.reason_code)) score += 4;
  if (lib.hasValue(target.program_code) && lib.equalsCI(candidate.program_code, target.program_code)) score += 3;
  if (lib.hasValue(target.pathway) && lib.equalsCI(candidate.pathway, target.pathway)) score += 3;
  if (lib.hasValue(target.assigned_pathway_type) && lib.equalsCI(candidate.assigned_pathway_type, target.assigned_pathway_type)) score += 2;
  return score;
}

function chooseEnrichmentMatch(row, candidates) {
  var best = null;
  var bestScore = -1;
  for (var i = 0; i < candidates.length; i++) {
    var score = scoreEnrichmentMatch(row, candidates[i]);
    if (score > bestScore) {
      best = candidates[i];
      bestScore = score;
    }
  }
  return best;
}

function enrichRowsFromOutputDocs(rows) {
  var out = [];
  var cache = {};

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var copy = copyRow(row);

    if (lib.hasValue(copy.output_payload_uri)) {
      var uri = String(copy.output_payload_uri);
      if (!cache[uri]) {
        cache[uri] = flattenDocDeterminations(readDocObject(uri));
      }
      var match = chooseEnrichmentMatch(copy, cache[uri]);
      if (match) {
        if (!lib.hasValue(copy.person_full_name)) copy.person_full_name = match.person_full_name;
        if (!lib.hasValue(copy.person_sex)) copy.person_sex = match.person_sex;
      if (!lib.hasValue(copy.person_age)) copy.person_age = match.person_age;
      if (!lib.hasValue(copy.person_age_category)) copy.person_age_category = match.person_age_category;
      if (!lib.hasValue(copy.person_marital_status)) copy.person_marital_status = match.person_marital_status;
      if (!lib.hasValue(copy.person_relation_to_policyholder)) copy.person_relation_to_policyholder = match.person_relation_to_policyholder;
      if (!lib.hasValue(copy.person_caretaker_relationship)) copy.person_caretaker_relationship = match.person_caretaker_relationship;
      if (!lib.hasValue(copy.person_files_as)) copy.person_files_as = match.person_files_as;
      if (!lib.hasValue(copy.person_filing_status)) copy.person_filing_status = match.person_filing_status;
      if (!lib.hasValue(copy.person_citizenship_status)) copy.person_citizenship_status = match.person_citizenship_status;
      if (!lib.hasValue(copy.person_current_residence_state)) copy.person_current_residence_state = match.person_current_residence_state;
      if (copy.person_is_parent_or_caretaker === undefined || copy.person_is_parent_or_caretaker === null) copy.person_is_parent_or_caretaker = match.person_is_parent_or_caretaker;
      if (copy.person_has_dependent_child === undefined || copy.person_has_dependent_child === null) copy.person_has_dependent_child = match.person_has_dependent_child;
      if (copy.person_presently_uninsured === undefined || copy.person_presently_uninsured === null) copy.person_presently_uninsured = match.person_presently_uninsured;
      if (copy.person_has_access_to_public_employee_coverage === undefined || copy.person_has_access_to_public_employee_coverage === null) copy.person_has_access_to_public_employee_coverage = match.person_has_access_to_public_employee_coverage;
      if (!lib.hasValue(copy.person_household_size)) copy.person_household_size = match.person_household_size;
      if (!lib.hasValue(copy.household_magi_income_pct_fpl)) copy.household_magi_income_pct_fpl = match.household_magi_income_pct_fpl;
      if (!lib.hasValue(copy.household_resources)) copy.household_resources = match.household_resources;
      if (!lib.hasValue(copy.pathway)) copy.pathway = match.pathway;
      if (!lib.hasValue(copy.program_code)) copy.program_code = match.program_code;
      if (!lib.hasValue(copy.assigned_pathway_type)) copy.assigned_pathway_type = match.assigned_pathway_type;
      }
    }

    out.push(copy);
  }

  return out;
}

function rowMatchesBasicFilters(row, filters) {
  if (!row) return false;
  if (!isDeterminationRow(row)) return false;

  if (!lib.equalsCI(row.household_id, filters.householdId)) return false;
  if (!lib.equalsCI(row.correlation_id, filters.correlationId)) return false;
  if (!lib.equalsCI(row.household_state, filters.state)) return false;
  if (!lib.equalsCI(row.program_code, filters.programCode)) return false;
  if (!lib.equalsCI(row.pathway, filters.pathway)) return false;
  if (!lib.equalsCI(row.assigned_pathway_type, filters.assignedPathwayType)) return false;
  if (!lib.equalsCI(row.eligibility, filters.eligibility)) return false;
  if (!lib.equalsCI(row.reason_code, filters.reasonCode)) return false;
  if (!lib.equalsCI(row.person_sex, filters.sex)) return false;
  if (!lib.equalsCI(row.person_marital_status, filters.maritalStatus)) return false;
  if (!lib.equalsCI(row.person_age_category, filters.ageCategory)) return false;
  if (!lib.equalsCI(row.person_relation_to_policyholder, filters.relationToPolicyholder)) return false;
  if (!boolMatches(row.person_is_parent_or_caretaker, filters.isParentOrCaretaker)) return false;
  if (!boolMatches(row.person_has_dependent_child, filters.hasDependentChild)) return false;
  var marriedFilter = parseOptionalBool(filters.isMarried);
  if (marriedFilter !== null && isMarriedStatus(row.person_marital_status) !== marriedFilter) return false;

  if (lib.hasValue(filters.personName) && !lib.containsCI(row.person_full_name, filters.personName)) return false;

  var minAge = parseOptionalNumber(filters.minAge);
  var maxAge = parseOptionalNumber(filters.maxAge);
  var age = parseOptionalNumber(row.person_age);
  if (minAge !== null && age !== null && age < minAge) return false;
  if (maxAge !== null && age !== null && age > maxAge) return false;

  if (lib.hasValue(filters.q)) {
    var q = String(filters.q);
    var textMatch =
      lib.containsCI(row.household_id, q) ||
      lib.containsCI(row.correlation_id, q) ||
      lib.containsCI(row.household_state, q) ||
      lib.containsCI(row.person_full_name, q) ||
      lib.containsCI(row.person_marital_status, q) ||
      lib.containsCI(row.person_age_category, q) ||
      lib.containsCI(row.person_relation_to_policyholder, q) ||
      lib.containsCI(row.pathway, q) ||
      lib.containsCI(row.program_code, q) ||
      lib.containsCI(row.assigned_pathway_type, q) ||
      lib.containsCI(row.eligibility, q) ||
      lib.containsCI(row.reason_code, q);
    if (!textMatch) return false;
  }

  return true;
}

function rowMatchesPopulationFilter(row, filters, populationIndex) {
  if (!lib.hasValue(filters.populationType)) return true;
  var key = lib.makePersonKey(row.correlation_id, row.household_id, row.person_full_name);
  var populations = populationIndex[key] || [];
  for (var i = 0; i < populations.length; i++) {
    if (lib.equalsCI(populations[i], filters.populationType)) return true;
  }
  return false;
}

function attachPopulationTypes(rows, populationIndex) {
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var key = lib.makePersonKey(row.correlation_id, row.household_id, row.person_full_name);
    var copy = copyRow(row);
    copy.population_types = lib.distinctStrings(populationIndex[key] || []);
    out.push(copy);
  }
  return out;
}

function buildHouseholdIndex(caseRows) {
  var map = {};
  for (var i = 0; i < caseRows.length; i++) {
    map[String(caseRows[i].correlation_id)] = caseRows[i];
  }
  return map;
}

function attachCaseMetadata(rows, householdIndex) {
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var h = householdIndex[String(row.correlation_id)] || {};
    var copy = copyRow(row);
    copy.output_payload_uri = h.output_payload_uri || null;
    copy.input_payload_uri = h.input_payload_uri || null;
    copy.corticon_status = h.corticon_status || null;
    copy.person_count = h.person_count || null;
    out.push(copy);
  }
  return out;
}

function buildFacetResponse(filteredRows) {
  return {
    state: lib.topCounts(filteredRows, "household_state", 30),
    eligibility: lib.topCounts(filteredRows, "eligibility", 20),
    reasonCode: lib.topCounts(filteredRows, "reason_code", 100),
    programCode: lib.topCounts(filteredRows, "program_code", 100),
    assignedPathwayType: lib.topCounts(filteredRows, "assigned_pathway_type", 20),
    pathway: lib.topCounts(filteredRows, "pathway", 100),
    sex: lib.topCounts(filteredRows, "person_sex", 10),
    maritalStatus: lib.topCounts(filteredRows, "person_marital_status", 20),
    ageCategory: lib.topCounts(filteredRows, "person_age_category", 20),
    relationToPolicyholder: lib.topCounts(filteredRows, "person_relation_to_policyholder", 30),
    isParentOrCaretaker: lib.topCounts(filteredRows, "person_is_parent_or_caretaker", 5),
    hasDependentChild: lib.topCounts(filteredRows, "person_has_dependent_child", 5)
  };
}

function populationFacet(filteredRows, populationIndex) {
  var values = [];
  for (var i = 0; i < filteredRows.length; i++) {
    var key = lib.makePersonKey(filteredRows[i].correlation_id, filteredRows[i].household_id, filteredRows[i].person_full_name);
    var populations = lib.distinctStrings(populationIndex[key] || []);
    for (var j = 0; j < populations.length; j++) values.push(populations[j]);
  }
  return lib.topCountsFromValues(values, 100);
}

function requiresRowEnrichmentForFiltering(filters) {
  return (
    lib.hasValue(filters.q) ||
    lib.hasValue(filters.personName) ||
    lib.hasValue(filters.sex) ||
    lib.hasValue(filters.maritalStatus) ||
    lib.hasValue(filters.ageCategory) ||
    lib.hasValue(filters.relationToPolicyholder) ||
    lib.hasValue(filters.isParentOrCaretaker) ||
    lib.hasValue(filters.hasDependentChild) ||
    lib.hasValue(filters.isMarried) ||
    lib.hasValue(filters.minAge) ||
    lib.hasValue(filters.maxAge)
  );
}

function listDeterminations(params) {
  var page = lib.getIntParam(params, "page", 1, 1, 1000000);
  var pageLength = lib.getIntParam(params, "pageLength", 25, 1, 200);
  var scanLimit = lib.getIntParam(params, "scanLimit", DEFAULT_SCAN_LIMIT, 100, 50000);
  var sortBy = lib.getParam(params, "sortBy", "household_id");
  var sortDir = lib.getParam(params, "sortDirection", "asc");
  var includeFacets = lib.getBoolParam(params, "includeFacets", true);

  var filters = buildFilters(params);

  var determinationRows = lib.rowsFromView("corticon", "person_eligibility_determination", scanLimit);
  var populationRows = lib.rowsFromView("corticon", "person_population", scanLimit * 2);
  var caseRows = lib.rowsFromView("corticon", "household_case", scanLimit);

  var populationIndex = lib.buildPopulationIndex(populationRows);
  var householdIndex = buildHouseholdIndex(caseRows);
  var enrichSortableFields = {
    person_full_name: true,
    person_age: true,
    person_sex: true,
    person_marital_status: true,
    person_relation_to_policyholder: true,
    person_age_category: true,
    household_magi_income_pct_fpl: true
  };
  var shouldEnrichBeforeFiltering = includeFacets || requiresRowEnrichmentForFiltering(filters) || !!enrichSortableFields[sortBy];

  var rowsForFiltering = determinationRows;
  if (shouldEnrichBeforeFiltering) {
    rowsForFiltering = attachCaseMetadata(rowsForFiltering, householdIndex);
    rowsForFiltering = enrichRowsFromOutputDocs(rowsForFiltering);
  }

  var filtered = [];
  for (var i = 0; i < rowsForFiltering.length; i++) {
    var row = rowsForFiltering[i];
    if (!rowMatchesBasicFilters(row, filters)) continue;
    if (!rowMatchesPopulationFilter(row, filters, populationIndex)) continue;
    filtered.push(row);
  }

  filtered = attachPopulationTypes(filtered, populationIndex);
  filtered = attachCaseMetadata(filtered, householdIndex);

  var sortableFields = {
    household_id: true,
    correlation_id: true,
    household_state: true,
    person_full_name: true,
    person_age: true,
    person_age_category: true,
    person_marital_status: true,
    person_relation_to_policyholder: true,
    person_is_parent_or_caretaker: true,
    person_has_dependent_child: true,
    eligibility: true,
    reason_code: true,
    program_code: true,
    pathway: true,
    assigned_pathway_type: true,
    household_magi_income_pct_fpl: true
  };
  if (!sortableFields[sortBy]) sortBy = "household_id";
  lib.sortRows(filtered, sortBy, sortDir);

  var total = filtered.length;
  var rows = lib.paginate(filtered, page, pageLength);
  rows = enrichRowsFromOutputDocs(rows);

  var response = {
    ok: true,
    serviceVersion: SERVICE_VERSION,
    view: "eligibilityDeterminations",
    querySource: "corticon.person_eligibility_determination",
    page: page,
    pageLength: pageLength,
    total: total,
    totalPages: pageLength > 0 ? Math.ceil(total / pageLength) : 0,
    sortBy: sortBy,
    sortDirection: sortDir,
    scanLimit: scanLimit,
    scannedDeterminationRows: determinationRows.length,
    scannedPopulationRows: populationRows.length,
    filters: filters,
    rows: rows
  };

  if (includeFacets) {
    response.facets = buildFacetResponse(filtered);
    response.facets.populationType = populationFacet(filtered, populationIndex);
  }

  if (determinationRows.length >= scanLimit) {
    response.warnings = [
      "Scan limit reached; results/facets may be partial. Increase rs:scanLimit for larger datasets or move filters into indexed/TDE-backed Optic joins."
    ];
  }

  response.uiHints = {
    suggestedSearchOptionsName: "eligibility-determinations-options",
    primaryColumns: [
      "household_id",
      "person_full_name",
      "person_age",
      "person_marital_status",
      "household_state",
      "program_code",
      "pathway",
      "assigned_pathway_type",
      "eligibility",
      "reason_code"
    ]
  };

  return response;
}

exports.GET = function (context, params) {
  context.outputTypes = ["application/json"];
  try {
    return listDeterminations(params || {});
  } catch (e) {
    return {
      ok: false,
      serviceVersion: SERVICE_VERSION,
      error: e.message,
      stack: e.stack
    };
  }
};
