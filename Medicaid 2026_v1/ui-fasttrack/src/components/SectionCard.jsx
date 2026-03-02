export default function SectionCard({ title, subtitle, actions, children, className = "" }) {
  return (
    <section className={`section-card ${className}`.trim()}>
      <header className="section-card-header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="section-card-actions">{actions}</div> : null}
      </header>
      <div className="section-card-body">{children}</div>
    </section>
  );
}
