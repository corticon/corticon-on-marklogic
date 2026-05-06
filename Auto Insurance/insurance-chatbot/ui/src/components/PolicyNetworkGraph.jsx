import React, { useState } from 'react';
import { NetworkGraph } from 'ml-fasttrack';
import EntityDetailsModal from './EntityDetailsModal';

const PolicyNetworkGraph = ({ policy, theme }) => {
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!policy || !policy.payload || !policy.payload[0]) {
    return null;
  }

  const policyData = policy.payload[0];
  const items = {};

  // Helper to safely stringify or access properties
  const getEntityData = (type, index, idParts) => {
      if (type === 'policy') return policyData;
      if (type === 'driver' && policyData.drivers) return policyData.drivers[parseInt(index)];
      if (type === 'vehicle' && policyData.vehicles) return policyData.vehicles[parseInt(index)];
      return null;
  };

  // Policy node
  const policyId = `policy-${policyData.applicationId}`;
  items[policyId] = {
    id: policyId, // Explicitly add ID
    label: [{ text: `Policy: ${policyData.applicationId}` }],
    color: 'gold',
    // Store metadata to help with click retrieval if needed, though usually we parse ID
    data: { type: 'policy', id: policyId } 
  };

  // Driver nodes and links
  if (policyData.drivers) {
    policyData.drivers.forEach((driver, index) => {
      const driverId = `driver-${driver.first}-${driver.last}-${index}`;
      items[driverId] = {
        id: driverId, // Explicitly add ID
        label: [{ text: `Driver: ${driver.first} ${driver.last}` }],
        color: '#cce5ff',
        data: { type: 'driver', index, id: driverId }
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
        id: vehicleId, // Explicitly add ID
        label: [{ text: `Vehicle: ${vehicle.modelYear} ${vehicle.make} ${vehicle.model}` }],
        color: '#d4edda',
        data: { type: 'vehicle', index, id: vehicleId }
      };

      const linkId = `link-policy-vehicle-${index}`;
      items[linkId] = {
        id1: policyId,
        id2: vehicleId
      };
    });
  }

  const handleNodeClick = (params) => {
      let nodeId = null;
      
      if (!params) return;

      // The NetworkGraph component (via onSelectNode) typically passes an object 
      // where the key is the Node ID and the value is the node object.
      // Example: { "driver-Name-1": { label: ..., data: ... } }
      
      if (typeof params === 'object') {
          const keys = Object.keys(params);
          // Look for a key that matches our ID pattern (policy-*, driver-*, vehicle-*)
          // or just take the first key if it looks like an ID
          const validKey = keys.find(k => 
            k.startsWith('policy-') || 
            k.startsWith('driver-') || 
            k.startsWith('vehicle-')
          );
          
          if (validKey) {
              nodeId = validKey;
          } else if (params.id) {
              // Fallback: simple object with id property
              nodeId = params.id;
          } else if (params.nodes && params.nodes.length > 0) {
              // Fallback: vis-network style event
              nodeId = params.nodes[0];
          }
      } else if (typeof params === 'string') {
          nodeId = params;
      }

      if (nodeId) {
          const parts = nodeId.split('-');
          const type = parts[0];
          // For driver/vehicle, the index is the last part
          const index = parts[parts.length - 1]; 
          
          const data = getEntityData(type, index, parts);
          if (data) {
              setSelectedEntity({
                  title: `${type.charAt(0).toUpperCase() + type.slice(1)} Details`,
                  data: data
              });
              setIsModalOpen(true);
          }
      }
  };

  const chartProps = {
    options: {
      navigation: true,
      backgroundColor: theme === 'dark' ? '#1e1e1e' : 'white',
      interaction: { hover: true }
    }
  };

  return (
    <div style={{ height: '600px', border: '1px solid var(--border-color)', borderRadius: '5px', backgroundColor: theme === 'dark' ? '#1e1e1e' : 'white' }}>
      <NetworkGraph 
        items={items} 
        ChartProps={chartProps} 
        onSelectNode={handleNodeClick}
      />
      <EntityDetailsModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={selectedEntity?.title}
        data={selectedEntity?.data}
        theme={theme}
      />
    </div>
  );
};

export default PolicyNetworkGraph;