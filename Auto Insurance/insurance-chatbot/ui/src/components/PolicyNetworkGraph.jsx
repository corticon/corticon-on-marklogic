import React from 'react';
import { NetworkGraph } from 'ml-fasttrack';

const PolicyNetworkGraph = ({ policy }) => {
  if (!policy || !policy.payload || !policy.payload[0]) {
    return null;
  }

  const policyData = policy.payload[0];
  const items = {};

  // Policy node
  const policyId = `policy-${policyData.applicationId}`;
  items[policyId] = {
    label: [{ text: `Policy: ${policyData.applicationId}` }],
    color: 'gold'
  };

  // Driver nodes and links
  if (policyData.drivers) {
    policyData.drivers.forEach((driver, index) => {
      const driverId = `driver-${driver.first}-${driver.last}-${index}`;
      items[driverId] = {
        label: [{ text: `Driver: ${driver.first} ${driver.last}` }],
        color: '#cce5ff'
      };

      const linkId = `link-policy-driver-${index}`;
      items[linkId] = {
        id1: policyId,
        id2: driverId
      };
    });
  }

  // Vehicle nodes and links
  if (policyData.vehicles) {
    policyData.vehicles.forEach((vehicle, index) => {
      const vehicleId = `vehicle-${vehicle.make}-${vehicle.model}-${index}`;
      items[vehicleId] = {
        label: [{ text: `Vehicle: ${vehicle.modelYear} ${vehicle.make} ${vehicle.model}` }],
        color: '#d4edda'
      };

      const linkId = `link-policy-vehicle-${index}`;
      items[linkId] = {
        id1: policyId,
        id2: vehicleId
      };
    });
  }

  const settings = {
    options: {
      navigation: true,
      backgroundColor: 'white',
    }
  };

  return (
    <div style={{ height: '400px', border: '1px solid #ccc', borderRadius: '5px' }}>
      <NetworkGraph items={items} settings={settings} />
    </div>
  );
};

export default PolicyNetworkGraph;