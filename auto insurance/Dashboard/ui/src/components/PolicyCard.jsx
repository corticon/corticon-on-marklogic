// PolicyCard.jsx
export default function PolicyCard({ result, onSelect }) {
  // 'result' is now the policy object from the payload array
  const title = result?.familyName ? `${result.familyName} Family` : result?.applicationId || "Untitled";
  const snippet = `ID: ${result?.applicationId || "—"} • State: ${result?.state || "—"}`;

  return (
    <div className="border rounded-lg p-3 shadow hover:shadow-md cursor-pointer transition"
         onClick={() => onSelect?.(result)}>
      <h3 className="font-semibold text-blue-700">{title}</h3>
      {snippet && <p className="text-sm text-gray-600 truncate">{snippet}</p>}
    </div>
  );
}