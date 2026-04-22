/*
  Example Corticon.js Service Callout for Auto Insurance.

  Purpose:
  - Enrich Driver entities from reference documents already stored in MarkLogic.
  - Keep large or volatile reference data out of the decision request payload.
  - Demonstrate the same MarkLogic-side SCO pattern used in the DailyInsurance sample,
    but adapted to this auto insurance domain.

  Expected configuration:

  const configuration = {
    logLevel: 0,
    logFunction: xdmp.log,
    serviceCallout: {
      ctsApi: cts,
      riskProfileUriBase: "/data/reference/driver-risk"
    }
  };

  Expected reference document shape:
  {
    "garageRiskTier": "Urban",
    "priorCarrierScore": 0.82,
    "riskZoneDriven": "Moderate"
  }
*/

const enrichDriverRiskProfile = {
  func: "enrichDriverRiskProfileFct",
  type: "ServiceCallout",
  description: {
    en_US: "Enrich driver entities with risk profile data retrieved from MarkLogic."
  },
  extensionType: "SERVICE_CALLOUT",
  name: {
    en_US: "enrichDriverRiskProfile"
  }
};

let logger;

function enrichDriverRiskProfileFct(corticonDataManager) {
  logger = corticonDataManager.getLogger();
  logger.logDebug("Starting enrichDriverRiskProfileFct service callout");

  const configuration = corticonDataManager.getConfiguration() || {};
  const cts = requireCtsApi(configuration);
  const uriBase = requireStringConfig(configuration, "riskProfileUriBase");
  const drivers = corticonDataManager.getEntitiesByType("Driver") || [];

  drivers.forEach((driver, index) => {
    const uri = buildRiskProfileUri(uriBase, driver, index);
    const doc = cts.doc(uri);
    if (!doc) {
      logger.logDebug(`No risk profile found for ${uri}`);
      return;
    }

    const profile = doc.toObject();
    if (profile.garageRiskTier !== undefined) {
      driver.garageRiskTier = profile.garageRiskTier;
    }
    if (profile.priorCarrierScore !== undefined) {
      driver.priorCarrierScore = profile.priorCarrierScore;
    }
    if (profile.riskZoneDriven !== undefined) {
      driver.riskZoneDriven = profile.riskZoneDriven;
    }
  });

  logger.logDebug("Completed enrichDriverRiskProfileFct service callout");
}

function requireCtsApi(configuration) {
  if (!configuration || !configuration.ctsApi) {
    throw new Error("Missing service callout configuration property 'ctsApi'");
  }
  return configuration.ctsApi;
}

function requireStringConfig(configuration, name) {
  if (!configuration || typeof configuration[name] !== "string" || configuration[name].trim() === "") {
    throw new Error(`Missing service callout configuration property '${name}'`);
  }
  return configuration[name].replace(/\/$/, "");
}

function buildRiskProfileUri(uriBase, driver, index) {
  const applicationId = sanitizePathPart(driver.applicationId || "unknown-application");
  const driverKey = sanitizePathPart(
    driver.driverId ||
    driver.id ||
    [driver.first, driver.last].filter(Boolean).join("-") ||
    `driver-${index + 1}`
  );
  return `${uriBase}/${applicationId}/${driverKey}.json`;
}

function sanitizePathPart(value) {
  return String(value || "unknown").replace(/[^A-Za-z0-9_-]+/g, "-");
}

exports.enrichDriverRiskProfile = enrichDriverRiskProfile;
exports.enrichDriverRiskProfileFct = enrichDriverRiskProfileFct;