// PolicyCard.jsx
export default function PolicyCard({ result, onSelect }) {
  const title = result?.uri?.split("/").pop() || "Untitled";
  const snippet =
    Array.isArray(result?.matches)
      ? result.matches
          .flatMap(m => m["match-text"] || [])
          .map(t => (typeof t === "string" ? t : t.highlight))
          .filter(Boolean)
          .join(" … ")
      : (result?.content?.payload?.familyName || result?.content?.payload?.state || "");
  return (
    <div className="border rounded-lg p-3 shadow hover:shadow-md cursor-pointer transition"
         onClick={() => onSelect?.(result)}>
      <h3 className="font-semibold text-blue-700">{title}</h3>
      {snippet && <p className="text-sm text-gray-600 truncate">{snippet}</p>}
    </div>
  );
}
