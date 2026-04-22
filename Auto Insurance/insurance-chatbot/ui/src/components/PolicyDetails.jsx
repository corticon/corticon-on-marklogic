// src/components/PolicyDetails.jsx
import { useMemo, useState } from "react";
import PolicyCard from "./PolicyCard";
import DriversTable from "./DriversTable";
import VehiclesTable from "./VehiclesTable";
import DecisionLog from "./DecisionLog";
import ExecutionTrace from "./ExecutionTrace";
import PolicyNetworkGraph from "./PolicyNetworkGraph";
import {
  formatCurrency,
  formatWholeNumber,
  getCoverageRows,
  getPolicyFinancialSummary,
  getPolicyMessages,
  getPolicyPayload,
  getRiskSignals,
  getRulesheetLeaders,
  getTopMessages,
  getTraceMetrics,
  normalizeList
} from "../utils/policyUtils";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "drivers", label: "Drivers" },
  { id: "vehicles", label: "Vehicles" },
  { id: "decision", label: "Decision Log" },
  { id: "trace", label: "Execution Trace" }
];

export default function PolicyDetails({ policy }) {
  const [activeTab, setActiveTab] = useState("overview");

  const policyData = useMemo(() => getPolicyPayload(policy), [policy]);
  const messages = useMemo(() => getPolicyMessages(policy), [policy]);
  const metrics = useMemo(() => getTraceMetrics(policy), [policy]);

  if (!policyData) {
    return <div className="widget-panel placeholder-panel">No policy details available.</div>;
  }

  const financialSummary = getPolicyFinancialSummary(policyData);
  const coverageRows = getCoverageRows(policyData);
  const riskSignals = getRiskSignals(policyData, messages);
  const topMessages = getTopMessages(messages, 3);
  const rulesheetLeaders = getRulesheetLeaders(messages, 4);
  const driverCount = normalizeList(policyData.drivers).length;
  const vehicleCount = normalizeList(policyData.vehicles).length;

  return (
    <section className="policy-workspace">
      <PolicyCard policyData={policyData} />

      <div className="stat-grid">
        <div className="stat-card accent-gold">
          <span className="stat-label">Drivers in policy</span>
          <strong>{formatWholeNumber(driverCount)}</strong>
        </div>
        <div className="stat-card accent-blue">
          <span className="stat-label">Vehicles in policy</span>
          <strong>{formatWholeNumber(vehicleCount)}</strong>
        </div>
        <div className="stat-card accent-green">
          <span className="stat-label">Coverage premium total</span>
          <strong>{formatCurrency(financialSummary.coveragePremium)}</strong>
        </div>
        <div className="stat-card accent-sand">
          <span className="stat-label">Trace events</span>
          <strong>{formatWholeNumber(metrics?.attributeChanges?.length || 0)}</strong>
        </div>
      </div>

      <div className="tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "tab-button active" : "tab-button"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <div className="overview-grid">
          <section className="widget-panel">
            <div className="widget-heading compact">
              <div>
                <h3>Pricing composition</h3>
                <p>How base premium, discount lift, and final premium are combining in this decision.</p>
              </div>
            </div>

            <div className="pricing-stack">
              <div className="pricing-line">
                <span>Base premium</span>
                <strong>{formatCurrency(financialSummary.basePremium)}</strong>
              </div>
              <div className="pricing-line accent">
                <span>Discount lift</span>
                <strong>-{formatCurrency(financialSummary.discountLift)}</strong>
              </div>
              <div className="pricing-line total">
                <span>Final premium</span>
                <strong>{formatCurrency(financialSummary.finalPremium)}</strong>
              </div>
            </div>

            <div className="coverage-bars">
              {coverageRows.slice(0, 6).map((coverage) => {
                const width = financialSummary.finalPremium > 0 ? Math.max(12, (coverage.premium / financialSummary.finalPremium) * 100) : 12;
                return (
                  <div key={coverage.id} className="coverage-bar-row">
                    <div>
                      <strong>{coverage.part}</strong>
                      <span>{coverage.vehicleLabel}</span>
                    </div>
                    <div className="coverage-meter">
                      <span style={{ width: `${width}%` }} />
                    </div>
                    <strong>{formatCurrency(coverage.premium)}</strong>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="widget-panel">
            <div className="widget-heading compact">
              <div>
                <h3>Risk markers</h3>
                <p>Signals that deserve an underwriter’s attention before renewal or escalation.</p>
              </div>
            </div>

            <div className="risk-grid">
              {riskSignals.map((signal) => (
                <article key={signal.label} className={signal.tone === "alert" ? "risk-card is-alert" : "risk-card"}>
                  <span>{signal.label}</span>
                  <strong>{formatWholeNumber(signal.value)}</strong>
                </article>
              ))}
            </div>

            <div className="tag-cloud">
              <span className="feature-chip">Paperless {policyData.isPaperless ? "enabled" : "disabled"}</span>
              <span className="feature-chip">AutoPay {policyData.isAutoPay ? "enabled" : "disabled"}</span>
              <span className="feature-chip">Home policy {policyData.hasHomePolicy ? "linked" : "not linked"}</span>
            </div>
          </section>

          <section className="widget-panel">
            <div className="widget-heading compact">
              <div>
                <h3>Decision narrative</h3>
                <p>Top explainability messages and rulesheets from the Corticon execution output.</p>
              </div>
            </div>

            <div className="message-stack">
              {topMessages.length > 0 ? topMessages.map((message, index) => (
                <article key={`${message.ruleSheet}-${index}`} className="message-callout">
                  <span className="message-kicker">{message.severity || "Info"} · {message.ruleSheet || "Rulesheet"}</span>
                  <p>{message.text}</p>
                </article>
              )) : <p className="muted-copy">No decision messages were returned for this policy.</p>}
            </div>

            <div className="rulesheet-strip">
              {rulesheetLeaders.map((leader) => (
                <div key={leader.label} className="rulesheet-pill">
                  <span>{leader.label}</span>
                  <strong>{formatWholeNumber(leader.count)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="widget-panel widget-panel--full">
            <div className="widget-heading compact">
              <div>
                <h3>Policy network</h3>
                <p>The current policy, driver, and vehicle relationships in one visual lane.</p>
              </div>
            </div>
            <PolicyNetworkGraph policy={policy} />
          </section>
        </div>
      ) : null}

      {activeTab === "drivers" ? <DriversTable drivers={policyData.drivers} /> : null}
      {activeTab === "vehicles" ? <VehiclesTable vehicles={policyData.vehicles} /> : null}
      {activeTab === "decision" ? <DecisionLog messages={messages} /> : null}
      {activeTab === "trace" ? <ExecutionTrace metrics={metrics} /> : null}
    </section>
  );
}