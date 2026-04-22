const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});

export function formatCurrency(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "N/A";
  }
  return currencyFormatter.format(numericValue);
}

export function formatPercent(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "N/A";
  }
  return percentFormatter.format(numericValue <= 1 ? numericValue : numericValue / 100);
}

export function formatWholeNumber(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "0";
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(numericValue);
}

export function normalizeList(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined) {
    return [];
  }
  return [value];
}

export function getPolicyPayload(policy) {
  if (!policy) {
    return null;
  }
  if (Array.isArray(policy.payload)) {
    return policy.payload[0] || null;
  }
  return policy.payload || null;
}

export function getPolicyMessages(policy) {
  return normalizeList(policy?.corticon?.messages?.message);
}

export function getTraceMetrics(policy) {
  return policy?.corticon?.Metrics || null;
}

export function yesNo(value) {
  return value ? "Yes" : "No";
}

export function countBy(items, fieldName) {
  const counts = new Map();
  normalizeList(items).forEach((item) => {
    const rawValue = item?.[fieldName];
    const key = rawValue === null || rawValue === undefined || rawValue === "" ? "(none)" : String(rawValue);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.label.localeCompare(right.label);
    });
}

export function getCoverageRows(policyData) {
  return normalizeList(policyData?.vehicles).flatMap((vehicle, vehicleIndex) =>
    normalizeList(vehicle?.coverages).map((coverage, coverageIndex) => ({
      id: `${policyData?.applicationId || "policy"}-${vehicleIndex}-${coverageIndex}`,
      vehicleLabel: `${vehicle?.modelYear || ""} ${vehicle?.make || ""} ${vehicle?.model || vehicle?.bodyStyle || "Vehicle"}`.replace(/\s+/g, " ").trim(),
      part: coverage?.part || "Coverage",
      compulsory: coverage?.compulsary === true,
      baseRate: Number(coverage?.baseRate) || 0,
      discountTotal: Number(coverage?.discountTotal) || 0,
      premium: Number(coverage?.premium) || 0,
      discountCount: normalizeList(coverage?.discount).length,
      surchargeCount: normalizeList(coverage?.surcharge).length
    }))
  );
}

export function getDriverRows(drivers) {
  return normalizeList(drivers).map((driver, index) => {
    const incidents = normalizeList(driver?.incidents);
    const discounts = normalizeList(driver?.discount);
    const surcharges = normalizeList(driver?.surcharge);
    const age = Number(driver?.age);

    return {
      id: `${driver?.applicationId || "driver"}-${index}`,
      name: `${driver?.first || ""} ${driver?.last || ""}`.trim() || `Driver ${index + 1}`,
      age: Number.isFinite(age) ? age : "N/A",
      licensed: driver?.yearLicensed || "N/A",
      incidents: incidents.length,
      incidentSummary: incidents.map((incident) => incident?.incidentType || incident?.type || "Incident").join(", ") || "Clean record",
      discounts: discounts.map((discount) => discount?.category || discount?.description || "Discount").join(", ") || "No discounts",
      surcharges: surcharges.map((surcharge) => surcharge?.description || surcharge?.category || "Surcharge").join(", ") || "No surcharges",
      segment: incidents.length > 0 ? "Watch" : age < 25 ? "Youthful" : "Preferred"
    };
  });
}

export function getVehicleRows(vehicles) {
  return normalizeList(vehicles).map((vehicle, index) => ({
    id: `${vehicle?.applicationId || "vehicle"}-${index}`,
    label: `${vehicle?.modelYear || ""} ${vehicle?.make || ""} ${vehicle?.model || vehicle?.bodyStyle || "Vehicle"}`.replace(/\s+/g, " ").trim(),
    bodyStyle: vehicle?.bodyStyle || vehicle?.type || "N/A",
    highTheft: vehicle?.isHighTheft === true ? "High" : "Standard",
    netPremium: Number(vehicle?.netPremium) || 0,
    coverageCount: normalizeList(vehicle?.coverages).length,
    coverageSummary: normalizeList(vehicle?.coverages).map((coverage) => coverage?.part || "Coverage").join(", ") || "No coverages"
  }));
}

export function getMessageSeveritySummary(messages) {
  return {
    info: normalizeList(messages).filter((message) => String(message?.severity || "").toLowerCase() === "info").length,
    warning: normalizeList(messages).filter((message) => String(message?.severity || "").toLowerCase() === "warning").length,
    violation: normalizeList(messages).filter((message) => String(message?.severity || "").toLowerCase() === "violation").length
  };
}

export function getRiskSignals(policyData, messages) {
  const driverRows = getDriverRows(policyData?.drivers);
  const vehicleRows = getVehicleRows(policyData?.vehicles);
  const severitySummary = getMessageSeveritySummary(messages);

  return [
    {
      label: "High-theft vehicles",
      value: vehicleRows.filter((vehicle) => vehicle.highTheft === "High").length,
      tone: vehicleRows.some((vehicle) => vehicle.highTheft === "High") ? "alert" : "calm"
    },
    {
      label: "Drivers with incidents",
      value: driverRows.filter((driver) => driver.incidents > 0).length,
      tone: driverRows.some((driver) => driver.incidents > 0) ? "alert" : "calm"
    },
    {
      label: "Warnings or violations",
      value: severitySummary.warning + severitySummary.violation,
      tone: severitySummary.warning + severitySummary.violation > 0 ? "alert" : "calm"
    },
    {
      label: "Compulsory coverages",
      value: getCoverageRows(policyData).filter((coverage) => coverage.compulsory).length,
      tone: "calm"
    }
  ];
}

export function getPolicyFinancialSummary(policyData) {
  const coverageRows = getCoverageRows(policyData);
  const basePremium = coverageRows.reduce((total, coverage) => total + coverage.baseRate, 0);
  const discountLift = coverageRows.reduce((total, coverage) => total + coverage.discountTotal, 0);
  const coveragePremium = coverageRows.reduce((total, coverage) => total + coverage.premium, 0);

  return {
    basePremium,
    discountLift,
    coveragePremium,
    finalPremium: Number(policyData?.netPremium) || coveragePremium,
    coverageRows
  };
}

export function getTopMessages(messages, limit = 3) {
  return normalizeList(messages).slice(0, limit);
}

export function getRulesheetLeaders(messages, limit = 4) {
  return countBy(messages, "ruleSheet").slice(0, limit);
}