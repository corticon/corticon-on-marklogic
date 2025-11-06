import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "../App.css";
// Fix Leaflet’s default icon path for Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});
/**
 * HouseholdsByState
 * ----------------------------------------------------
 * Visualizes household counts per state of residence.
 * Uses react-leaflet + GeoJSON boundaries.
 */
export default function HouseholdsByState() {
  const [geoData, setGeoData] = useState(null);
  const [householdCounts, setHouseholdCounts] = useState({});

  // Load US states GeoJSON
  useEffect(() => {
    fetch("https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json")
      .then((res) => res.json())
      .then((data) => setGeoData(data));
  }, []);

  // Fetch household counts from MarkLogic REST endpoint
  // (assuming an endpoint like /api/household-counts-by-state or adapt as needed)
  useEffect(() => {
    fetch("http://localhost:4001/api/household-counts-by-state")
      .then((res) => res.json())
      .then((data) => setHouseholdCounts(data))
      .catch(() => {
        // fallback mock data if backend unavailable
        setHouseholdCounts({
          GA: 35,
          FL: 22,
          TX: 48,
          CA: 50,
          NY: 28,
          NC: 19,
        });
      });
  }, []);

  // Map color scale based on household density
  const getColor = (count) => {
    if (count > 40) return "#005a8c";
    if (count > 25) return "#007ac2";
    if (count > 10) return "#63b3ed";
    return "#dbeafe";
  };

  const styleFeature = (feature) => {
    const abbrev = feature.properties.postal;
    const count = householdCounts[abbrev] || 0;
    return {
      fillColor: getColor(count),
      weight: 1,
      opacity: 1,
      color: "#fff",
      fillOpacity: 0.8,
    };
  };

  return (
    <div className="map-container">
      {geoData ? (
        <MapContainer
          center={[37.8, -96]}
          zoom={4}
          minZoom={3}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <GeoJSON
            data={geoData}
            style={styleFeature}
            onEachFeature={(feature, layer) => {
              const abbrev = feature.properties.postal;
              const count = householdCounts[abbrev] || 0;
              layer.bindTooltip(
                `<strong>${feature.properties.name}</strong><br/>${count} household${count !== 1 ? "s" : ""}`,
                { sticky: true }
              );
            }}
          />
        </MapContainer>
      ) : (
        <div className="placeholder">Loading map...</div>
      )}
    </div>
  );
}
