import { formatCurrency, normalizeList, yesNo } from "../utils/policyUtils";

export default function PolicyCard({ policyData, onSelect, selected = false, variant = "hero" }) {
  if (!policyData) {
    return null;
  }
  const driverCount = normalizeList(policyData.drivers).length;
  const vehicleCount = normalizeList(policyData.vehicles).length;

  const cardClassName = [
    "policy-card",
    `policy-card--${variant}`,
    onSelect ? "is-selectable" : "",
    selected ? "is-selected" : ""
  ].filter(Boolean).join(" ");

  return (
    <article className={cardClassName} onClick={onSelect}>
      <div className="policy-card-topline">
        <span className="policy-state-pill">{policyData.state || "No state"}</span>
        <span className="policy-id">{policyData.applicationId || "Unassigned ID"}</span>
      </div>

      <div className="policy-card-header">
        <div>
          <h2>{policyData.familyName ? `${policyData.familyName} household` : "Untitled policy"}</h2>
          <p>{driverCount} drivers, {vehicleCount} vehicles, paperless {yesNo(policyData.isPaperless).toLowerCase()}</p>
        </div>
        <div className="premium-pill">
          <span>Net premium</span>
          <strong>{formatCurrency(policyData.netPremium)}</strong>
        </div>
      </div>

      <div className="policy-tag-row">
        <span className="feature-chip">AutoPay {yesNo(policyData.isAutoPay)}</span>
        <span className="feature-chip">Multi-car {yesNo(policyData.isMultiCar)}</span>
        <span className="feature-chip">Home bundle {yesNo(policyData.hasHomePolicy)}</span>
      </div>
    </article>
  );
}