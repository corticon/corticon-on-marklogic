// ui/src/components/PoliciesByState.jsx

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { searchPolicies } from '../api/marklogicService'; // Corrected import
import PolicyCard from './PolicyCard';
import EntityDetailsModal from './EntityDetailsModal';


const stateCoordinates = {
  "AL": { "latitude": 32.806671, "longitude": -86.791130 },
  "AK": { "latitude": 61.370716, "longitude": -152.404419 },
  "AZ": { "latitude": 33.729759, "longitude": -111.431221 },
  "AR": { "latitude": 34.969704, "longitude": -92.373123 },
  "CA": { "latitude": 36.116203, "longitude": -119.681564 },
  "CO": { "latitude": 39.059811, "longitude": -105.311104 },
  "CT": { "latitude": 41.597782, "longitude": -72.755371 },
  "DE": { "latitude": 39.318523, "longitude": -75.507141 },
  "FL": { "latitude": 27.766279, "longitude": -81.686783 },
  "GA": { "latitude": 33.040619, "longitude": -83.643074 },
  "HI": { "latitude": 21.094318, "longitude": -157.498337 },
  "ID": { "latitude": 44.240459, "longitude": -114.478828 },
  "IL": { "latitude": 40.349457, "longitude": -88.986137 },
  "IN": { "latitude": 39.849426, "longitude": -86.258278 },
  "IA": { "latitude": 42.011539, "longitude": -93.210526 },
  "KS": { "latitude": 38.526600, "longitude": -96.726486 },
  "KY": { "latitude": 37.668140, "longitude": -84.670067 },
  "LA": { "latitude": 31.169546, "longitude": -91.867805 },
  "ME": { "latitude": 44.693947, "longitude": -69.381927 },
  "MD": { "latitude": 39.063946, "longitude": -76.802101 },
  "MA": { "latitude": 42.230171, "longitude": -71.530106 },
  "MI": { "latitude": 43.326618, "longitude": -84.536095 },
  "MN": { "latitude": 45.694454, "longitude": -93.900192 },
  "MS": { "latitude": 32.741646, "longitude": -89.678696 },
  "MO": { "latitude": 38.456085, "longitude": -92.288368 },
  "MT": { "latitude": 46.921925, "longitude": -110.454353 },
  "NE": { "latitude": 41.125370, "longitude": -98.268082 },
  "NV": { "latitude": 38.313515, "longitude": -117.055374 },
  "NH": { "latitude": 43.452492, "longitude": -71.563896 },
  "NJ": { "latitude": 40.298904, "longitude": -74.521011 },
  "NM": { "latitude": 34.840515, "longitude": -106.248482 },
  "NY": { "latitude": 42.165726, "longitude": -74.948051 },
  "NC": { "latitude": 35.630066, "longitude": -79.806419 },
  "ND": { "latitude": 47.528912, "longitude": -99.784012 },
  "OH": { "latitude": 40.388783, "longitude": -82.764915 },
  "OK": { "latitude": 35.565342, "longitude": -96.928917 },
  "OR": { "latitude": 44.572021, "longitude": -122.070938 },
  "PA": { "latitude": 40.590752, "longitude": -77.209755 },
  "RI": { "latitude": 41.680893, "longitude": -71.511780 },
  "SC": { "latitude": 33.856892, "longitude": -80.945007 },
  "SD": { "latitude": 44.299782, "longitude": -99.438828 },
  "TN": { "latitude": 35.747845, "longitude": -86.692345 },
  "TX": { "latitude": 31.054487, "longitude": -97.563461 },
  "UT": { "latitude": 40.150032, "longitude": -111.862434 },
  "VT": { "latitude": 44.045876, "longitude": -72.710686 },
  "VA": { "latitude": 37.769337, "longitude": -78.169968 },
  "WA": { "latitude": 47.400902, "longitude": -121.490494 },
  "WV": { "latitude": 38.491226, "longitude": -80.954453 },
  "WI": { "latitude": 44.268543, "longitude": -89.616508 },
  "WY": { "latitude": 42.755966, "longitude": -107.302490 }
};

const stateNameToAbbr = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
    "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA",
    "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
    "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
    "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH",
    "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC",
    "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA",
    "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", "Tennessee": "TN",
    "Texas": "TX", "Utah": "UT", "Vermont": "VT", "Virginia": "VA", "Washington": "WA",
    "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY"
};

// Simple hash function to generate deterministic offsets from policy ID
const getOffsetFromId = (id) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash = hash & hash;
  }
  const normalized = (hash % 1000) / 1000;
  return {
    lat: (normalized - 0.5) * 1.0,
    lng: ((hash % 500) / 500 - 0.5) * 1.0
  };
};

// Create custom icons for Leaflet - unique instance for each marker
const createCustomIcon = (isSearched = false, policyId = '') => {
  const color = isSearched ? '#0066cc' : '#cc0000';
  const shadow = isSearched ? 'drop-shadow(0 0 4px #0066cc)' : 'none';
  
  console.log(`Creating icon for ${policyId}, isSearched: ${isSearched}, color: ${color}`);
  
  // Use SVG for complete color control (like React Leaflet examples)
  return L.divIcon({
    html: `
      <div style="
        width: 25px; 
        height: 25px; 
        filter: ${shadow};
        transform: translateY(-50%);
      ">
        <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 19.4 12.5 25 12.5 25S25 19.4 25 12.5C25 5.6 19.4 0 12.5 0Z" fill="${color}"/>
          <circle cx="12.5" cy="12.5" r="4" fill="white"/>
        </svg>
      </div>
    `,
    iconSize: [25, 25],
    iconAnchor: [12, 25],
    popupAnchor: [0, -25],
    className: `custom-marker-${policyId}-${isSearched ? 'searched' : 'normal'}`
  });
};

const PoliciesByState = ({ theme, policy }) => {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  
  useEffect(() => {
    const fetchAllPolicies = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await searchPolicies(''); 
        setPolicies(data.results || []);
      } catch (err) {
        setError(err.message || 'Failed to fetch policies');
      } finally {
        setLoading(false);
      }
    };
    fetchAllPolicies();
  }, []);

  const handleMarkerClick = (policyData) => {
    setSelectedPolicy({
      title: `Policy Details - ${policyData.applicationId}`,
      data: policyData
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    // Clear selectedPolicy after a short delay to ensure modal unmounts
    setTimeout(() => setSelectedPolicy(null), 100);
  };

  // Create markers for display
  const markers = [];
  const searchedPolicyId = policy?.payload?.[0]?.applicationId;
  
  policies.forEach(doc => {
    if (!doc.payload || !doc.payload[0] || !doc.payload[0].state) return;
    
    const policyData = doc.payload[0];
    const stateAbbr = stateNameToAbbr[policyData.state];
    if (!stateAbbr) return;
    
    const coords = stateCoordinates[stateAbbr];
    if (!coords) return;
    
    const offset = getOffsetFromId(policyData.applicationId);
    const isSearchedPolicy = policyData.applicationId === searchedPolicyId;
    
    console.log(`Policy ${policyData.applicationId} - isSearched: ${isSearchedPolicy}, searchedId: ${searchedPolicyId}`);
    
    markers.push({
      position: [coords.latitude + offset.lat, coords.longitude + offset.lng],
      policyData: policyData,
      isSearched: isSearchedPolicy
    });
  });

  return (
    <div>
      {policy && policy.payload && policy.payload[0] && (
        <div className="policy-context-card">
          <PolicyCard policyData={policy.payload[0]} />
        </div>
      )}
      <h2>Policies by State</h2>
      {loading && <div>Loading policies...</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      
      {/* Interactive Leaflet Map */}
      <MapContainer 
        center={[39.810, -98.556]} 
        zoom={4} 
        style={{ height: '600px', width: '100%' }}
        zoomControl={true}
        attributionControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          subdomains={['a', 'b', 'c']}
        />
        {markers.map((marker, index) => (
          <Marker
            key={`${index}-${marker.isSearched ? 'searched' : 'normal'}`}
            position={marker.position}
            icon={createCustomIcon(marker.isSearched, marker.policyData.applicationId)}
            eventHandlers={{
              click: () => handleMarkerClick(marker.policyData)
            }}
          >
            <Tooltip permanent={false} direction="top" sticky={false}>
              <div style={{ pointerEvents: 'none' }}>
                <strong>{marker.policyData.applicationId}</strong><br/>
                {marker.policyData.state}<br/>
                {marker.policyData.familyName || 'N/A'}
              </div>
            </Tooltip>
            <Popup>
              <div>
                <strong>{marker.policyData.applicationId}</strong><br/>
                {marker.policyData.state}<br/>
                {marker.policyData.familyName || 'N/A'}<br/>
                <button 
                  onClick={() => handleMarkerClick(marker.policyData)}
                  style={{
                    marginTop: '5px',
                    padding: '4px 8px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  View Details
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {isModalOpen && selectedPolicy && (
        <EntityDetailsModal 
          isOpen={isModalOpen} 
          onClose={closeModal}
          title={selectedPolicy.title}
          data={selectedPolicy.data}
          theme={theme}
        />
      )}
    </div>
  );
};

export default PoliciesByState;