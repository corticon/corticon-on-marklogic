// src/components/PolicyDetails.jsx
import { useEffect, useState } from 'react';
import { getDocument } from '../api/marklogicService';

export default function PolicyDetails({ policyUri }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(policyUri));
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    if (!policyUri) {
      setData(null);
      setLoading(false);
      setError('No policy selected.');
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const payload = await getDocument(policyUri);
        console.log('getDocument payload', payload);
        if (!mounted) return;
        if (!payload || typeof payload !== 'object') {
          setError('Failed to load policy details.');
          setData(null);
        } else {
          // The actual data may be nested
          const doc = payload?.content ?? payload;
          setData(doc);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err.message);
        setData(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, [policyUri]);

  if (loading) {
    return (
      <calcite-panel heading="Policy Details">
        <calcite-loader label="Loading policy..." active></calcite-loader>
      </calcite-panel>
    );
  }

  if (error) {
    return (
      <calcite-panel heading="Policy Details">
        <calcite-notice kind="danger" open icon>
          <div slot="message">{error}</div>
        </calcite-notice>
      </calcite-panel>
    );
  }
  
  // Defensive rendering
  const policyData = data?.content ?? data ?? {};
  const insured = policyData?.insured ?? {};
  const drivers = Array.isArray(policyData?.drivers) ? policyData.drivers : [];
  const vehicles = Array.isArray(policyData?.vehicles) ? policyData.vehicles : [];
  const discounts = Array.isArray(policyData?.discounts) ? policyData.discounts : [];
  const surcharges = Array.isArray(policyData?.surcharges) ? policyData.surcharges : [];
  const premium = typeof policyData?.premium === 'number' ? policyData.premium : null;

  return (
    <calcite-panel heading={`Policy ${policyData?.policyNumber ?? policyUri}`}>
      <calcite-block heading="Insured" collapsible open>
        <div><strong>Name:</strong> {insured?.name ?? '—'}</div>
        <div><strong>Address:</strong> {insured?.address ?? '—'}</div>
      </calcite-block>

      <calcite-block heading={`Vehicles (${vehicles.length})`} collapsible>
        {vehicles.length === 0 ? 'No vehicles.' : vehicles.map((v) => (
          <calcite-card key={v?.vin ?? Math.random()}>
            <span slot="title">{[v?.year, v?.make, v?.model].filter(Boolean).join(' ') || 'Vehicle'}</span>
            <span slot="subtitle">{v?.vin ?? '—'}</span>
          </calcite-card>
        ))}
      </calcite-block>

      <calcite-block heading={`Drivers (${drivers.length})`} collapsible>
        {drivers.length === 0 ? 'No drivers.' : drivers.map((d) => (
          <calcite-card key={d?.id ?? d?.name ?? Math.random()}>
            <span slot="title">{d?.name ?? 'Driver'}</span>
            <span slot="subtitle">{Number.isFinite(d?.age) ? `Age ${d.age}` : ''}</span>
          </calcite-card>
        ))}
      </calcite-block>

      <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
        <calcite-block heading={`Discounts (${discounts.length})`} collapsible>
          {discounts.length === 0 ? 'None.' : (
            <ul>{discounts.map((x, i) => <li key={i}>{x}</li>)}</ul>
          )}
        </calcite-block>

        <calcite-block heading={`Surcharges (${surcharges.length})`} collapsible>
          {surcharges.length === 0 ? 'None.' : (
            <ul>{surcharges.map((x, i) => <li key={i}>{x}</li>)}</ul>
          )}
        </calcite-block>
      </div>

      <calcite-block heading="Premium" collapsible>
        {premium === null ? '—' : premium.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
      </calcite-block>
    </calcite-panel>
  );
}
