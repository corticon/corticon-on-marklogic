// ui/src/components/PoliciesByState.jsx

import React, { useState, useEffect } from 'react';
import { GeoMap } from 'ml-fasttrack';
import { searchPolicies } from '../api/marklogicService'; // Correct import

const stateCoordinates = {
  // ... (stateCoordinates object remains the same)
};

const stateNameToAbbr = {
  // ... (stateNameToAbbr object remains the same)
};

const PoliciesByState = () => {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(false); // Set to false initially
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAllPolicies = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await searchPolicies(''); // Call searchPolicies instead
        // The results are now directly the policy payloads.
        setPolicies(data.results || []);
      } catch (err) {
        setError(err.message || 'Failed to fetch policies');
      } finally {
        setLoading(false);
      }
    };
    fetchAllPolicies();
  }, []);

  const transformMarkers = (policies) => {
    if (!policies) return [];

    const policiesByState = policies.reduce((acc, doc) => {
        if (doc.payload && doc.payload[0] && doc.payload[0].state) {
          const fullStateName = doc.payload[0].state;
          const stateAbbr = stateNameToAbbr[fullStateName];
          if (stateAbbr) {
            if (!acc[stateAbbr]) {
              acc[stateAbbr] = { count: 0, state: stateAbbr };
            }
            acc[stateAbbr].count++;
          }
        }
      return acc;
    }, {});

    return Object.values(policiesByState).map(stateData => {
      const coords = stateCoordinates[stateData.state];
      if (!coords) {
        return null;
      }

      return {
        point: {
          latitude: coords.latitude,
          longitude: coords.longitude,
          uri: stateData.state
        },
        symbol: {
          type: 'simple-marker',
          color: 'blue',
          size: '10px',
        },
        popupTemplate: {
            title: `${stateData.state}`,
            content: `Number of policies: ${stateData.count}`
        }
      };
    }).filter(Boolean);
  };

  return (
    <div>
      <h2>Policies by State</h2>
      {loading && <div>Loading...</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <div style={{ height: '600px', border: '1px solid #ccc', borderRadius: '5px' }}>
        <GeoMap
          markers={policies}
          transformMarkers={transformMarkers}
          esriApiKey="AAPTxy8BH1VEsoebNVZXo8HurB6tqQwavudVSaREHRyGRjgF6CfWanva0OmOthzBIROC5AhBVEafVdatjzKvwC7agHkGMq7XXvxgys_nD2DNRa2b58dXLgLn9FdfQ1wtKcYzWlbmXxWpJ9Tw_1ndEOk2btmYn3NdopZhq5_ito9OsdkcDHctFRUhH9Z_wy2R2eJmIEW-EPjOUbI-PdfJWSmtsOE8YUUoDrBRoukp0dsorRc.AT1_YaYwaQ6t" // <-- IMPORTANT: Replace with your actual ESRI API Key
          viewType="2D"
          zoom={3}
          center={[-98.556, 39.810]}
        />
      </div>
      <p><strong>Note:</strong> You need to replace "YOUR_ESRI_API_KEY" with your actual ESRI API Key in the `PoliciesByState.jsx` component.</p>
    </div>
  );
};

export default PoliciesByState;