const PolicyNetworkGraph = ({ policy }) => {
  const policyData = Array.isArray(policy?.payload) ? policy.payload[0] : policy?.payload;

  if (!policyData) {
    return null;
  }

  const nodes = [
    {
      id: `policy-${policyData.applicationId}`,
      label: `Policy ${policyData.applicationId}`,
      caption: policyData.state || "State pending",
      color: "#1a3447",
      x: 360,
      y: 72
    }
  ];
  const links = [];

  const policyId = nodes[0].id;

  (policyData.drivers || []).forEach((driver, index) => {
    const driverId = `driver-${index}`;
    nodes.push({
      id: driverId,
      label: `${driver.first || "Driver"} ${driver.last || index + 1}`.trim(),
      caption: `Age ${driver.age || "N/A"}`,
      color: "#e6f0ff",
      x: 180,
      y: 162 + index * 104
    });
    links.push({ from: policyId, to: driverId });
  });

  (policyData.vehicles || []).forEach((vehicle, index) => {
    const vehicleId = `vehicle-${index}`;
    nodes.push({
      id: vehicleId,
      label: `${vehicle.modelYear || ""} ${vehicle.make || ""} ${vehicle.model || vehicle.bodyStyle || "Vehicle"}`.replace(/\s+/g, " ").trim(),
      caption: vehicle.isHighTheft ? "High theft" : "Standard theft profile",
      color: "#f6eadc",
      x: 540,
      y: 162 + index * 104
    });
    links.push({ from: policyId, to: vehicleId });
  });

  const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]));

  return (
    <div className="network-graph-shell">
      <svg viewBox="0 0 720 420" className="network-graph" role="img" aria-label="Policy relationship graph">
        <defs>
          <linearGradient id="policyGraphBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f8efe4" />
            <stop offset="100%" stopColor="#eef5f7" />
          </linearGradient>
        </defs>
        <rect width="720" height="420" rx="28" fill="url(#policyGraphBg)" />
        {links.map((link, index) => {
          const from = nodeById[link.from];
          const to = nodeById[link.to];
          return (
            <line
              key={`${link.from}-${link.to}-${index}`}
              x1={from.x}
              y1={from.y + 22}
              x2={to.x}
              y2={to.y + 22}
              stroke="#506b7c"
              strokeOpacity="0.55"
              strokeWidth="2.2"
            />
          );
        })}
        {nodes.map((node) => (
          <g key={node.id} transform={`translate(${node.x - 116}, ${node.y})`}>
            <rect width="232" height="52" rx="16" fill={node.color} stroke="rgba(26, 52, 71, 0.18)" strokeWidth="1.5" />
            <text x="116" y="22" textAnchor="middle" className="network-node-label">
              {node.label}
            </text>
            <text x="116" y="38" textAnchor="middle" className="network-node-caption">
              {node.caption}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export default PolicyNetworkGraph;