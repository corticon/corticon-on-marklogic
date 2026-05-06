"use strict";

var lib = require("/ext/autoInsuranceLib.sjs");

var DEFAULT_SCAN_LIMIT = 5000;

function getParam(params, name, defaultValue) {
  if (!params) return defaultValue;
  var rsName = "rs:" + name;
  if (params[rsName] !== null && params[rsName] !== undefined) return params[rsName];
  if (params[name] !== null && params[name] !== undefined) return params[name];
  return defaultValue;
}

function parseIntParam(params, name, defaultValue) {
  var raw = getParam(params, name, null);
  var value = raw === null ? defaultValue : parseInt(String(raw), 10);
  return isNaN(value) ? defaultValue : value;
}

function buildFilters(params) {
  return {
    q: getParam(params, "q", ""),
    state: getParam(params, "state", "")
  };
}

function filterDetails(rows, filters) {
  return (rows || []).filter(function (row) {
    if (!lib.equalsCI(row.state, filters.state)) return false;
    if (lib.hasValue(filters.q)) {
      var q = filters.q;
      var matches =
        lib.containsCI(row.applicationId, q) ||
        lib.containsCI(row.familyName, q) ||
        lib.containsCI(row.state, q) ||
        lib.containsCI(row.paymentPlan, q);
      if (!matches) return false;
    }
    return true;
  });
}

function toIdSet(rows) {
  var out = {};
  (rows || []).forEach(function (row) {
    if (lib.hasValue(row.applicationId)) {
      out[String(row.applicationId)] = true;
    }
  });
  return out;
}

function filterByIds(rows, idSet) {
  return (rows || []).filter(function (row) {
    return idSet[String(row.applicationId)] === true;
  });
}

function average(rows, fieldName) {
  var total = 0;
  var count = 0;
  (rows || []).forEach(function (row) {
    var value = Number(row[fieldName]);
    if (!isNaN(value)) {
      total += value;
      count += 1;
    }
  });
  return count ? Number((total / count).toFixed(2)) : 0;
}

function countWhere(rows, predicate) {
  var count = 0;
  (rows || []).forEach(function (row) {
    if (predicate(row)) count += 1;
  });
  return count;
}

function groupPremiumByState(detailsRows) {
  var grouped = {};
  (detailsRows || []).forEach(function (row) {
    var state = lib.hasValue(row.state) ? String(row.state) : "(none)";
    if (!grouped[state]) {
      grouped[state] = { state: state, policyCount: 0, totalNetPremium: 0, premiumCount: 0 };
    }
    grouped[state].policyCount += 1;
    var premium = Number(row.netPremium);
    if (!isNaN(premium)) {
      grouped[state].totalNetPremium += premium;
      grouped[state].premiumCount += 1;
    }
  });

  return Object.keys(grouped)
    .map(function (state) {
      var item = grouped[state];
      return {
        state: item.state,
        policyCount: item.policyCount,
        avgNetPremium: item.premiumCount ? Number((item.totalNetPremium / item.premiumCount).toFixed(2)) : 0
      };
    })
    .sort(function (a, b) {
      if (b.policyCount !== a.policyCount) return b.policyCount - a.policyCount;
      return String(a.state).localeCompare(String(b.state));
    });
}

function topValueSums(rows, labelField, valueField, limit) {
  var grouped = {};
  (rows || []).forEach(function (row) {
    var label = lib.hasValue(row[labelField]) ? String(row[labelField]) : "(none)";
    if (!grouped[label]) {
      grouped[label] = { label: label, count: 0, totalValue: 0 };
    }
    grouped[label].count += 1;
    var value = Number(row[valueField]);
    if (!isNaN(value)) {
      grouped[label].totalValue += value;
    }
  });

  return Object.keys(grouped)
    .map(function (key) {
      return {
        value: key,
        count: grouped[key].count,
        totalValue: Number(grouped[key].totalValue.toFixed(2))
      };
    })
    .sort(function (a, b) {
      if (b.totalValue !== a.totalValue) return b.totalValue - a.totalValue;
      if (b.count !== a.count) return b.count - a.count;
      return String(a.value).localeCompare(String(b.value));
    })
    .slice(0, limit || 10);
}

exports.GET = function (context, params) {
  try {
    var scanLimit = parseIntParam(params, "scanLimit", DEFAULT_SCAN_LIMIT);
    var filters = buildFilters(params);

    var details = filterDetails(lib.rowsFromView("policy", "Details", scanLimit), filters);
    var policyIds = toIdSet(details);
    var drivers = filterByIds(lib.rowsFromView("policy", "Drivers", scanLimit), policyIds);
    var vehicles = filterByIds(lib.rowsFromView("policy", "Vehicles", scanLimit), policyIds);
    var coverages = filterByIds(lib.rowsFromView("policy", "Coverages", scanLimit), policyIds);
    var discounts = filterByIds(lib.rowsFromView("policy", "Discounts", scanLimit), policyIds);
    var surcharges = filterByIds(lib.rowsFromView("policy", "Surcharges", scanLimit), policyIds);
    var messages = filterByIds(lib.rowsFromView("corticon", "Messages", scanLimit), policyIds);

    context.outputTypes = ["application/json"];
    return {
      ok: true,
      filters: filters,
      generatedAt: lib.nowIso(),
      summary: {
        policyCount: details.length,
        avgNetPremium: average(details, "netPremium"),
        avgDriverAge: average(drivers, "age"),
        multiCarPolicies: countWhere(details, function (row) { return row.isMultiCar === true; }),
        paperlessPolicies: countWhere(details, function (row) { return row.isPaperless === true; }),
        highTheftVehicles: countWhere(vehicles, function (row) { return row.isHighTheft === true; }),
        compulsoryCoverageCount: countWhere(coverages, function (row) { return row.compulsary === true; })
      },
      stateBreakdown: groupPremiumByState(details),
      topDiscounts: topValueSums(discounts, "category", "value", 10),
      topSurcharges: topValueSums(surcharges, "description", "value", 10),
      topMessages: lib.topCounts(messages, "text", 10, "(no message)"),
      messageSeverities: lib.topCounts(messages, "severity", 10, "(none)"),
      rulesheetActivity: lib.topCounts(messages, "ruleSheet", 10, "(none)"),
      driverSegments: {
        youthfulDrivers: countWhere(drivers, function (row) { return Number(row.age) < 25; }),
        goodStudents: countWhere(drivers, function (row) { return row.goodStudent === true; }),
        trainedDrivers: countWhere(drivers, function (row) { return row.advancedDriverTraining === true; })
      },
      coverageMix: lib.topCounts(coverages, "part", 20, "(none)"),
      paymentPlans: lib.topCounts(details, "paymentPlan", 10, "(none)")
    };
  } catch (e) {
    xdmp.log("analytics ERROR: " + e.stack);
    context.outputTypes = ["application/json"];
    return { ok: false, error: true, message: e.message, stack: e.stack };
  }
};