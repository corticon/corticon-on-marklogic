"use strict";

var op = require("/MarkLogic/optic");

var PARAM_ALIASES = {
  q: ["query", "text"],
  page: ["pageNumber"],
  pageLength: ["pageSize", "page-size", "limit"],
  sortBy: ["sort", "orderBy"],
  sortDirection: ["sortDir", "dir", "direction"],
  includeFacets: ["facets"],
  scanLimit: ["scan-limit"],
  householdId: ["household_id"],
  correlationId: ["correlation_id"],
  personName: ["person_name"],
  programCode: ["program", "program_code"],
  assignedPathwayType: ["assigned_pathway_type"],
  reasonCode: ["reason", "reason_code"],
  populationType: ["population", "population_type"],
  minAge: ["min_age"],
  maxAge: ["max_age"]
};

function hasValue(v) {
  return v !== null && v !== undefined && String(v).trim() !== "";
}

function normalizeText(v) {
  return hasValue(v) ? String(v).trim() : "";
}

function normalizeLower(v) {
  return normalizeText(v).toLowerCase();
}

function getParam(params, name, defaultValue) {
  if (!params) return defaultValue;
  var names = [String(name)];
  var aliases = PARAM_ALIASES[String(name)] || [];
  for (var i = 0; i < aliases.length; i++) names.push(String(aliases[i]));

  for (i = 0; i < names.length; i++) {
    var rsName = "rs:" + names[i];
    if (params[rsName] !== null && params[rsName] !== undefined) return params[rsName];
    if (params[names[i]] !== null && params[names[i]] !== undefined) return params[names[i]];
  }
  return defaultValue;
}

function getIntParam(params, name, defaultValue, minValue, maxValue) {
  var raw = getParam(params, name, null);
  var value = raw === null ? defaultValue : parseInt(String(raw), 10);
  if (!(value >= 0)) value = defaultValue;
  if (minValue !== null && minValue !== undefined && value < minValue) value = minValue;
  if (maxValue !== null && maxValue !== undefined && value > maxValue) value = maxValue;
  return value;
}

function getBoolParam(params, name, defaultValue) {
  var raw = getParam(params, name, null);
  if (raw === null || raw === undefined) return defaultValue;
  var s = String(raw).toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return defaultValue;
}

function parseJsonBody(input) {
  if (!input) return {};

  try {
    if (typeof input.toObject === "function") {
      return input.toObject() || {};
    }
  } catch (e1) {}

  try {
    if (input.root && typeof input.root.toObject === "function") {
      return input.root.toObject() || {};
    }
  } catch (e2) {}

  try {
    var txt = xdmp.getRequestBody("text");
    return txt ? JSON.parse(String(txt)) : {};
  } catch (e3) {
    return {};
  }
}

function stripQualifier(k) {
  var idx = String(k).lastIndexOf(".");
  return idx >= 0 ? String(k).substring(idx + 1) : String(k);
}

function normalizeRow(row) {
  if (!row || typeof row !== "object") return row;
  var out = {};
  var keys = Object.keys(row);
  for (var i = 0; i < keys.length; i++) {
    out[stripQualifier(keys[i])] = row[keys[i]];
  }
  return out;
}

function normalizeRows(rows) {
  var out = [];
  rows = rows || [];
  for (var i = 0; i < rows.length; i++) out.push(normalizeRow(rows[i]));
  return out;
}

function runPlan(plan) {
  return plan.result().toArray();
}

function rowsFromView(schema, viewName, scanLimit) {
  var n = scanLimit || 5000;
  return normalizeRows(runPlan(op.fromView(schema, viewName).limit(n)));
}

function makePersonKey(correlationId, householdId, personFullName) {
  return normalizeText(correlationId) + "|" + normalizeText(householdId) + "|" + normalizeLower(personFullName);
}

function buildPopulationIndex(popRows) {
  var index = {};
  popRows = popRows || [];
  for (var i = 0; i < popRows.length; i++) {
    var row = popRows[i];
    var key = makePersonKey(row.correlation_id, row.household_id, row.person_full_name);
    if (!index[key]) index[key] = [];
    if (hasValue(row.population_type)) index[key].push(String(row.population_type));
  }
  return index;
}

function distinctStrings(values) {
  var seen = {};
  var out = [];
  values = values || [];
  for (var i = 0; i < values.length; i++) {
    var v = normalizeText(values[i]);
    if (!v || seen[v]) continue;
    seen[v] = true;
    out.push(v);
  }
  return out;
}

function containsCI(value, search) {
  if (!hasValue(search)) return true;
  return normalizeLower(value).indexOf(normalizeLower(search)) >= 0;
}

function equalsCI(value, expected) {
  if (!hasValue(expected)) return true;
  return normalizeLower(value) === normalizeLower(expected);
}

function topCounts(rows, fieldName, limit, options) {
  var map = {};
  var n = limit || 20;
  var nullLabel = (options && options.nullLabel) || "(null)";

  rows = rows || [];
  for (var i = 0; i < rows.length; i++) {
    var key = rows[i] && rows[i][fieldName];
    var label = hasValue(key) ? String(key) : nullLabel;
    map[label] = (map[label] || 0) + 1;
  }

  return mapToTopArray(map, n);
}

function topCountsFromValues(values, limit, nullLabel) {
  var map = {};
  var n = limit || 20;
  var nl = nullLabel || "(null)";
  values = values || [];
  for (var i = 0; i < values.length; i++) {
    var label = hasValue(values[i]) ? String(values[i]) : nl;
    map[label] = (map[label] || 0) + 1;
  }
  return mapToTopArray(map, n);
}

function mapToTopArray(map, limit) {
  var rows = [];
  var keys = Object.keys(map || {});
  for (var i = 0; i < keys.length; i++) {
    rows.push({ value: keys[i], count: map[keys[i]] });
  }
  rows.sort(function (a, b) {
    if (b.count !== a.count) return b.count - a.count;
    return String(a.value).localeCompare(String(b.value));
  });
  return rows.slice(0, limit || 20);
}

function paginate(rows, page, pageLength) {
  var p = page || 1;
  var n = pageLength || 20;
  var start = (p - 1) * n;
  return rows.slice(start, start + n);
}

function sortRows(rows, fieldName, direction) {
  var dir = normalizeLower(direction) === "asc" ? 1 : -1;
  rows.sort(function (a, b) {
    var av = a ? a[fieldName] : null;
    var bv = b ? b[fieldName] : null;
    if (av === null || av === undefined) return (bv === null || bv === undefined) ? 0 : 1;
    if (bv === null || bv === undefined) return -1;

    var as = String(av);
    var bs = String(bv);

    var an = Number(as), bn = Number(bs);
    if (!isNaN(an) && !isNaN(bn)) {
      if (an < bn) return -1 * dir;
      if (an > bn) return 1 * dir;
      return 0;
    }
    var cmp = as.localeCompare(bs);
    return cmp * dir;
  });
  return rows;
}

function badRequest(message, extra) {
  var out = { ok: false, error: message };
  if (extra && typeof extra === "object") {
    var keys = Object.keys(extra);
    for (var i = 0; i < keys.length; i++) out[keys[i]] = extra[keys[i]];
  }
  return out;
}

module.exports = {
  op: op,
  hasValue: hasValue,
  normalizeText: normalizeText,
  normalizeLower: normalizeLower,
  getParam: getParam,
  getIntParam: getIntParam,
  getBoolParam: getBoolParam,
  parseJsonBody: parseJsonBody,
  normalizeRow: normalizeRow,
  normalizeRows: normalizeRows,
  runPlan: runPlan,
  rowsFromView: rowsFromView,
  makePersonKey: makePersonKey,
  buildPopulationIndex: buildPopulationIndex,
  distinctStrings: distinctStrings,
  containsCI: containsCI,
  equalsCI: equalsCI,
  topCounts: topCounts,
  topCountsFromValues: topCountsFromValues,
  mapToTopArray: mapToTopArray,
  paginate: paginate,
  sortRows: sortRows,
  badRequest: badRequest
};
