export default function MetricCard({ title, value, subtitle, accent = "blue" }) {
  return (
    <article className={`metric-card metric-${accent}`}>
      <div className="metric-title">{title}</div>
      <div className="metric-value">{value}</div>
      {subtitle ? <div className="metric-subtitle">{subtitle}</div> : null}
    </article>
  );
}
