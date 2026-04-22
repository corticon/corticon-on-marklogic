import { useEffect, useMemo, useState } from "react";
import { CategoricalChart } from "ml-fasttrack";
import { getAnalytics } from "../api/marklogicService";
import { formatCurrency, formatWholeNumber } from "../utils/policyUtils";

const stateCoordinates = {
  AL: { latitude: 32.806671, longitude: -86.79113 },
  AZ: { latitude: 33.729759, longitude: -111.431221 },
  AR: { latitude: 34.969704, longitude: -92.373123 },
  CA: { latitude: 36.116203, longitude: -119.681564 },
  CO: { latitude: 39.059811, longitude: -105.311104 },
  CT: { latitude: 41.597782, longitude: -72.755371 },
  DC: { latitude: 38.9072, longitude: -77.0369 },
  DE: { latitude: 39.318523, longitude: -75.507141 },
  FL: { latitude: 27.766279, longitude: -81.686783 },
  GA: { latitude: 33.040619, longitude: -83.643074 },
  HI: { latitude: 21.094318, longitude: -157.498337 },
  ID: { latitude: 44.240459, longitude: -114.478828 },
  IL: { latitude: 40.349457, longitude: -88.986137 },
  IN: { latitude: 39.849426, longitude: -86.258278 },
  IA: { latitude: 42.011539, longitude: -93.210526 },
  KS: { latitude: 38.5266, longitude: -96.726486 },
  KY: { latitude: 37.66814, longitude: -84.670067 },
  LA: { latitude: 31.169546, longitude: -91.867805 },
  ME: { latitude: 44.693947, longitude: -69.381927 },
  MD: { latitude: 39.063946, longitude: -76.802101 },
  MA: { latitude: 42.230171, longitude: -71.530106 },
  MI: { latitude: 43.326618, longitude: -84.536095 },
  MN: { latitude: 45.694454, longitude: -93.900192 },
  MS: { latitude: 32.741646, longitude: -89.678696 },
  MO: { latitude: 38.456085, longitude: -92.288368 },
  MT: { latitude: 46.921925, longitude: -110.454353 },
  NE: { latitude: 41.12537, longitude: -98.268082 },
  NV: { latitude: 38.313515, longitude: -117.055374 },
  NH: { latitude: 43.452492, longitude: -71.563896 },
  NJ: { latitude: 40.298904, longitude: -74.521011 },
  NM: { latitude: 34.840515, longitude: -106.248482 },
  NY: { latitude: 42.165726, longitude: -74.948051 },
  NC: { latitude: 35.630066, longitude: -79.806419 },
  ND: { latitude: 47.528912, longitude: -99.784012 },
  OH: { latitude: 40.388783, longitude: -82.764915 },
  OK: { latitude: 35.565342, longitude: -96.928917 },
  OR: { latitude: 44.572021, longitude: -122.070938 },
  PA: { latitude: 40.590752, longitude: -77.209755 },
  RI: { latitude: 41.680893, longitude: -71.51178 },
  SC: { latitude: 33.856892, longitude: -80.945007 },
  SD: { latitude: 44.299782, longitude: -99.438828 },
  TN: { latitude: 35.747845, longitude: -86.692345 },
  TX: { latitude: 31.054487, longitude: -97.563461 },
  UT: { latitude: 40.15, longitude: -111.862434 },
  VA: { latitude: 37.769337, longitude: -78.169968 },
  VT: { latitude: 44.045876, longitude: -72.710686 },
  WA: { latitude: 47.400902, longitude: -121.490494 },
  WV: { latitude: 38.491226, longitude: -80.954453 },
  WI: { latitude: 44.268543, longitude: -89.616508 },
  WY: { latitude: 42.755966, longitude: -107.30249 }
};

const stateNameToAbbr = {
  Alabama: "AL",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  "District of Columbia": "DC",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Virginia: "VA",
  Vermont: "VT",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY"
};

function projectPoint(latitude, longitude) {
  const minLon = -125;
  const maxLon = -66;
  const minLat = 24;
  const maxLat = 50;
  return {
    x: ((longitude - minLon) / (maxLon - minLon)) * 760 + 20,
    y: ((maxLat - latitude) / (maxLat - minLat)) * 360 + 20
  };
}

function transformMarkers(states) {
  return (states || []).map((stateData) => {
    const stateAbbr = stateNameToAbbr[stateData.state] || stateData.state;
    const coords = stateCoordinates[stateAbbr];
    if (!coords) {
      return null;
    }

    const projected = projectPoint(coords.latitude, coords.longitude);
    return {
      id: stateAbbr,
      state: stateData.state,
      policyCount: stateData.policyCount,
      avgNetPremium: stateData.avgNetPremium,
      x: projected.x,
      y: projected.y,
      radius: Math.max(8, Math.min(26, 8 + Math.sqrt(stateData.policyCount) * 4))
    };
  }).filter(Boolean);
}

export default function PoliciesByState() {
  const [analytics, setAnalytics] = useState(null);
  const [availableStates, setAvailableStates] = useState([]);
  const [selectedState, setSelectedState] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      setError("");
      try {
        const payload = await getAnalytics(selectedState ? { state: selectedState } : {});
        setAnalytics(payload);
        if (!selectedState) {
          setAvailableStates(payload.stateBreakdown?.map((entry) => entry.state) || []);
        }
      } catch (fetchError) {
        setError(fetchError.message || "Failed to fetch analytics");
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [selectedState]);

  const markers = useMemo(() => transformMarkers(analytics?.stateBreakdown || []), [analytics]);

  return (
    <div className="portfolio-intel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Portfolio intelligence</span>
          <h2>Underwriting pulse across the book</h2>
          <p>Track premium concentration, rulesheet activity, severity mix, and the parts of the country driving pricing behavior.</p>
        </div>
        <div className="state-filter-strip">
          <button className={!selectedState ? "state-chip active" : "state-chip"} onClick={() => setSelectedState("")}>All states</button>
          {availableStates.slice(0, 10).map((state) => (
            <button
              key={state}
              className={selectedState === state ? "state-chip active" : "state-chip"}
              onClick={() => setSelectedState(state)}
            >
              {state}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="widget-panel">Loading portfolio analytics…</div> : null}
      {error ? <div className="widget-panel error-banner">{error}</div> : null}

      {analytics ? (
        <>
          <div className="stat-grid stat-grid--portfolio">
            <div className="stat-card accent-gold">
              <span className="stat-label">Policies in scope</span>
              <strong>{formatWholeNumber(analytics.summary?.policyCount)}</strong>
              <small>Current filter: {selectedState || "All states"}</small>
            </div>
            <div className="stat-card accent-blue">
              <span className="stat-label">Average net premium</span>
              <strong>{formatCurrency(analytics.summary?.avgNetPremium)}</strong>
              <small>Book-wide premium centerline</small>
            </div>
            <div className="stat-card accent-green">
              <span className="stat-label">High-theft vehicles</span>
              <strong>{formatWholeNumber(analytics.summary?.highTheftVehicles)}</strong>
              <small>Vehicle theft exposure markers</small>
            </div>
            <div className="stat-card accent-sand">
              <span className="stat-label">Youthful drivers</span>
              <strong>{formatWholeNumber(analytics.driverSegments?.youthfulDrivers)}</strong>
              <small>Potential underwriting watchlist</small>
            </div>
          </div>

          <div className="portfolio-grid portfolio-grid--hero">
            <section className="widget-panel map-panel">
              <div className="widget-heading">
                <div>
                  <h3>State distribution</h3>
                  <p>Bubble size reflects policy concentration. Labels show average premium.</p>
                </div>
              </div>
              <svg viewBox="0 0 800 420" className="portfolio-map" role="img" aria-label="Auto insurance policy geography overview">
                <rect x="10" y="10" width="780" height="400" rx="26" fill="rgba(251, 247, 241, 0.98)" stroke="rgba(26, 52, 71, 0.14)" />
                {markers.map((marker) => (
                  <g key={marker.id} transform={`translate(${marker.x}, ${marker.y})`}>
                    <circle r={marker.radius} fill="rgba(198, 127, 61, 0.18)" stroke="#1a3447" strokeWidth="2" />
                    <text y="4" textAnchor="middle" className="map-marker-code">{marker.id}</text>
                    <text y={marker.radius + 18} textAnchor="middle" className="map-marker-caption">{marker.policyCount} policies</text>
                    <text y={marker.radius + 34} textAnchor="middle" className="map-marker-caption muted">{formatCurrency(marker.avgNetPremium)}</text>
                  </g>
                ))}
              </svg>
            </section>

            <section className="widget-panel leaderboard-panel">
              <div className="widget-heading">
                <div>
                  <h3>Decision ledger hotspots</h3>
                  <p>The message, discount, and payment-plan themes most likely to show up in review conversations.</p>
                </div>
              </div>

              <div className="leaderboard-block">
                <h4>Top discounts</h4>
                <ul className="leaderboard-list">
                  {(analytics.topDiscounts || []).slice(0, 5).map((entry) => (
                    <li key={entry.value}>
                      <span>{entry.value}</span>
                      <strong>{formatWholeNumber(entry.count)}</strong>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="leaderboard-block">
                <h4>Payment plans</h4>
                <ul className="leaderboard-list">
                  {(analytics.paymentPlans || []).slice(0, 4).map((entry) => (
                    <li key={entry.value}>
                      <span>{entry.value}</span>
                      <strong>{formatWholeNumber(entry.count)}</strong>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="leaderboard-block">
                <h4>Message severity</h4>
                <ul className="leaderboard-list">
                  {(analytics.messageSeverities || []).map((entry) => (
                    <li key={entry.value}>
                      <span>{entry.value}</span>
                      <strong>{formatWholeNumber(entry.count)}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>

          <div className="portfolio-grid">
            <section className="widget-panel chart-panel">
              <div className="widget-heading">
                <div>
                  <h3>Average premium by state</h3>
                  <p>Top states by average premium using the live TDE analytics resource.</p>
                </div>
              </div>
              <CategoricalChart
                data={analytics.stateBreakdown || []}
                chartType="bar"
                transformData={(items) => items.slice(0, 8).map((item) => ({ category: item.state, value: item.avgNetPremium }))}
                settings={{
                  barChartProps: {
                    title: { text: "Average net premium" },
                    tooltip: { visible: true }
                  }
                }}
              />
            </section>

            <section className="widget-panel chart-panel">
              <div className="widget-heading">
                <div>
                  <h3>Coverage mix</h3>
                  <p>Coverage concentration across the portfolio, useful for spotting book composition drift.</p>
                </div>
              </div>
              <CategoricalChart
                data={analytics.coverageMix || []}
                chartType="donut"
                transformData={(items) => items.slice(0, 6).map((item) => ({ category: item.value, value: item.count }))}
                settings={{
                  donutChartProps: {
                    title: { text: "Coverage mix" },
                    tooltip: { visible: true }
                  }
                }}
              />
            </section>

            <section className="widget-panel chart-panel">
              <div className="widget-heading">
                <div>
                  <h3>Rulesheet activity</h3>
                  <p>Which rulesheets are currently generating the most decision chatter.</p>
                </div>
              </div>
              <CategoricalChart
                data={analytics.rulesheetActivity || []}
                chartType="column"
                transformData={(items) => items.slice(0, 7).map((item) => ({ category: item.value, value: item.count }))}
                settings={{
                  columnChartProps: {
                    title: { text: "Rulesheet activity" },
                    tooltip: { visible: true }
                  }
                }}
              />
            </section>
          </div>

          <section className="widget-panel narrative-panel">
            <div className="widget-heading">
              <div>
                <h3>Portfolio narrative</h3>
                <p>Useful talking points for a demo or underwriting review session.</p>
              </div>
            </div>
            <div className="narrative-grid">
              <article>
                <h4>Pricing posture</h4>
                <p>
                  {selectedState || "The book"} is averaging {formatCurrency(analytics.summary?.avgNetPremium)} across {formatWholeNumber(analytics.summary?.policyCount)} active decisions.
                  {analytics.topDiscounts?.[0] ? ` The dominant discount theme is ${analytics.topDiscounts[0].value}.` : ""}
                </p>
              </article>
              <article>
                <h4>Underwriting watchpoints</h4>
                <p>
                  High-theft exposure is currently {formatWholeNumber(analytics.summary?.highTheftVehicles)} vehicles, while {formatWholeNumber(analytics.driverSegments?.youthfulDrivers)} youthful drivers remain in scope.
                </p>
              </article>
              <article>
                <h4>Explainability load</h4>
                <p>
                  The highest message volume is coming from {analytics.rulesheetActivity?.[0]?.value || "the core rating rulesheets"}, which makes it a good candidate for a guided trace demo.
                </p>
              </article>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}