'use strict';

var op = require('/MarkLogic/optic');

var SERVICE_VERSION = "analytics-2026-01-12-a";

function badRequest(msg) {
  return { ok: false, error: msg, serviceVersion: SERVICE_VERSION };
}

function runPlan(plan) {
  return plan.result().toArray();
}

function selectedCoaTop10() {
  var plan = op.fromView('eligibility', 'coa')
    .where(op.eq(op.col('isSelected'), true))
    .groupBy(op.col('name'), op.count('count'))
    .orderBy(op.desc('count'))
    .limit(10);
  return runPlan(plan);
}

function evaluatedCoaTop10() {
  var plan = op.fromView('eligibility', 'coa')
    .groupBy(op.col('name'), op.count('count'))
    .orderBy(op.desc('count'))
    .limit(10);
  return runPlan(plan);
}

function traceFlagCounts() {
  var plan = op.fromView('eligibility', 'trace_flags')
    .where(
      op.or(
        op.eq(op.col('attributeName'), 'incomeIneligible'),
        op.eq(op.col('attributeName'), 'blanketIneligible'),
        op.eq(op.col('attributeName'), 'nonFinancialCriteriaMet'),
        op.eq(op.col('attributeName'), 'eligibleViaPath'),
        op.eq(op.col('attributeName'), 'isSelected')
      )
    )
    .groupBy([op.col('attributeName'), op.col('newValue')], op.count('count'))
    .orderBy(op.desc('count'))
    .limit(20);

  return runPlan(plan);
}

function topRules(limit) {
  var n = Number(limit || 15);
  if (!(n > 0)) n = 15;

  var plan = op.fromView('eligibility', 'trace_flags')
    .where(
      op.and(
        op.ne(op.col('rulesheetName'), null),
        op.ne(op.col('ruleNumber'), null)
      )
    )
    .groupBy([op.col('rulesheetName'), op.col('ruleNumber')], op.count('count'))
    .orderBy(op.desc('count'))
    .limit(n);

  return runPlan(plan);
}

/**
 * Resolve household by person name.
 * Make it case-insensitive by normalizing both sides.
 * (Still uses exact match on normalized strings.)
 */
function resolveHouseholdByPersonName(first, last) {
  if (!first || !last) return [];

  var f = String(first).trim().toLowerCase();
  var l = String(last).trim().toLowerCase();

  var plan = op.fromView('eligibility', 'coa')
    .where(
      op.and(
        op.eq(op.fn.lowerCase(op.col('personFirst')), f),
        op.eq(op.fn.lowerCase(op.col('personLast')), l)
      )
    )
    .select([
      op.col('householdId'),
      op.col('familyName'),
      op.col('personFirst'),
      op.col('personLast')
    ])
    .limit(10);

  return runPlan(plan);
}

function drilldownHouseholdsForSelectedCoa(name, limit) {
  if (!name) return [];
  var n = Number(limit || 10);
  if (!(n > 0)) n = 10;

  var plan = op.fromView('eligibility', 'coa')
    .where(
      op.and(
        op.eq(op.col('isSelected'), true),
        op.eq(op.col('name'), String(name))
      )
    )
    .select([
      op.col('householdId'),
      op.col('familyName'),
      op.col('personFirst'),
      op.col('personLast'),
      op.col('policyKey'),
      op.col('name')
    ])
    .limit(n);

  return runPlan(plan);
}

function get(context, params) {
  var action = params && params['rs:action']
    ? String(params['rs:action'])
    : (params && params.action ? String(params.action) : '');

  if (action === 'selected-coa') {
    return { ok: true, action: action, rows: selectedCoaTop10(), serviceVersion: SERVICE_VERSION };
  }
  if (action === 'evaluated-coa') {
    return { ok: true, action: action, rows: evaluatedCoaTop10(), serviceVersion: SERVICE_VERSION };
  }
  if (action === 'ineligibility-flags') {
    return { ok: true, action: action, rows: traceFlagCounts(), serviceVersion: SERVICE_VERSION };
  }
  if (action === 'top-rules') {
    var limit = params && (params['rs:limit'] || params.limit);
    return { ok: true, action: action, rows: topRules(limit), serviceVersion: SERVICE_VERSION };
  }
  if (action === 'resolve-person') {
    var first = params && (params['rs:first'] || params.first);
    var last  = params && (params['rs:last']  || params.last);
    return { ok: true, action: action, rows: resolveHouseholdByPersonName(first, last), serviceVersion: SERVICE_VERSION };
  }
  if (action === 'examples') {
    var name = params && (params['rs:name'] || params.name);
    var limit2 = params && (params['rs:limit'] || params.limit);
    return { ok: true, action: action, rows: drilldownHouseholdsForSelectedCoa(name, limit2), serviceVersion: SERVICE_VERSION };
  }

  return badRequest('Unsupported rs:action. Try: selected-coa, evaluated-coa, ineligibility-flags, top-rules, resolve-person, examples');
}

exports.GET = get;
