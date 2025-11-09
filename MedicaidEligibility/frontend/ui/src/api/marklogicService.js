// MedicaidEligibility/frontend/ui/src/api/marklogicService.js

// Helper to fetch from our own Node.js server's analytics endpoint
const fetchAnalytics = async (type, params = {}) => {
  try {
    const url = new URL('/api/analytics', window.location.origin);
    url.searchParams.append('type', type);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Analytics API error (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    // MarkLogic /v1/rows returns data in a 'rows' property
    return data.rows || [];
  } catch (error) {
    console.error(`Failed to fetch analytics [${type}]:`, error);
    return [];
  }
};

// --- Canned Analytical Queries via server.js ---

export const getProgramEligibilityStats = () => fetchAnalytics('programEligibilityStats');
export const getNearMissIncomeStats = () => fetchAnalytics('nearMissIncomeStats');
export const getRuleFiringStats = () => fetchAnalytics('ruleFiringStats');
export const getDemographicTrends = () => fetchAnalytics('demographicTrends');

// --- Ad-hoc SQL via Proxy (if needed for custom exploration) ---
// This uses the generic proxy in server.js. We send it as JSON to avoid content-type issues,
// but server.js proxy might need tweaking if ML strictly demands application/sql for POST body.
// For now, rely on the canned queries above as they are safer.

// Mock Chatbot
export const sendMessage = async (message) => {
    console.log("Sending message to bot:", message);
    await new Promise(resolve => setTimeout(resolve, 500));
    return { reply: `You asked: "${message}". This is a mock response from the Medicaid Assistant.` };
};