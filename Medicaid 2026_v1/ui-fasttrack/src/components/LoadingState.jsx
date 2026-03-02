export default function LoadingState({ label = "Loading..." }) {
  return (
    <div className="loading-state">
      <div className="loading-spinner" />
      <span>{label}</span>
    </div>
  );
}
