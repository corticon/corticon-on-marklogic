function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (e) {
    return String(value);
  }
}

export default function JsonPreview({ value, maxHeight = 260 }) {
  return (
    <pre className="json-preview" style={{ maxHeight }}>
      {safeStringify(value)}
    </pre>
  );
}
