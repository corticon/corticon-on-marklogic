// components/PolicyDetails.jsx
import React from "react";

export default function PolicyDetails({ policy }) {
  if (!policy) return null;

  const {
    applicationId,
    familyName,
    addressLine1,
    city,
    state,
    postalCode,
    vehicles = [],
    drivers = [],
    discounts = [],
    surcharges = [],
    premium
  } = policy;

  const name = familyName || policy?.insured?.familyName || "—";
  const address = [addressLine1, city, state, postalCode].filter(Boolean).join(", ") || "—";

  return (
    <div className="mt-6">
      <calcite-panel heading={`Policy /data/policy-input/${applicationId}.json`}>
        <calcite-block heading="Insured" collapsible open>
          <div><strong>Name:</strong> {name}</div>
          <div><strong>Address:</strong> {address}</div>
          <div><strong>Customer Since:</strong> {policy.customerSince || "—"}</div>
          <div><strong>Payment Plan:</strong> {policy.paymentPlan || "—"}</div>
          <div><strong>Paperless:</strong> {policy.isPaperless ? "Yes" : "No"}</div>
          <div><strong>Home Policy:</strong> {policy.hasHomePolicy ? "Yes" : "No"}</div>
        </calcite-block>

        <calcite-block heading={`Vehicles (${vehicles.length})`} collapsible>
          {vehicles.map((v, i) => {
            const title = [v.make, v.model].filter(Boolean).join(" ") || "Vehicle";
            const subtitle = [v.year, v.trim].filter(Boolean).join(" • ");
            return (
              <calcite-card key={i}>
                <span slot="title">{title}</span>
                <span slot="subtitle">{subtitle || "—"}</span>
              </calcite-card>
            );
          })}
        </calcite-block>

        <calcite-block heading={`Drivers (${drivers.length})`} collapsible>
          {drivers.map((d, i) => {
            const title = [d.givenName, d.familyName].filter(Boolean).join(" ").trim() || "Driver";
            const subtitle = [d.licenseNumber, d.birthDate].filter(Boolean).join(" • ");
            return (
              <calcite-card key={i}>
                <span slot="title">{title}</span>
                <span slot="subtitle">{subtitle}</span>
              </calcite-card>
            );
          })}
        </calcite-block>

        <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.75rem" }}>
          <calcite-block heading={`Discounts (${discounts.length || 0})`} collapsible>
            {(!discounts || discounts.length === 0) ? "None." :
              discounts.map((d, i) => <div key={i}>{d.name || d.type} — {d.amount ?? d.percent ?? ""}</div>)
            }
          </calcite-block>
          <calcite-block heading={`Surcharges (${surcharges.length || 0})`} collapsible>
            {(!surcharges || surcharges.length === 0) ? "None." :
              surcharges.map((s, i) => <div key={i}>{s.name || s.type} — {s.amount ?? s.percent ?? ""}</div>)
            }
          </calcite-block>
        </div>

        <calcite-block heading="Premium" collapsible>
          {premium != null ? `$${Number(premium).toLocaleString()}` : "—"}
        </calcite-block>
      </calcite-panel>
    </div>
  );
}
