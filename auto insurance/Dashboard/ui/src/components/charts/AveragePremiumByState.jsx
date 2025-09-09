import { useEffect, useState } from "react";
import { searchDocuments } from "../../api/marklogicService";

export default function AveragePremiumByState() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchPremiums() {
      try {
        setLoading(true);
        setError(null);
        const res = await searchDocuments({ qtext: "" }, { pageLength: 100, start: 1, format: "json" });
        const docs = Array.isArray(res?.results) ? res.results.map((r) => r?.content).filter(Boolean) : [];

        const totals = {};
        for (const doc of docs) {
          const state = doc?.payload?.state || doc?.state || null;
          const raw = doc?.payload?.netPremium ?? doc?.netPremium ?? null;
          const premium = typeof raw === "number" ? raw : parseFloat(raw);
          if (!state || Number.isNaN(premium)) continue;
          if (!totals[state]) totals[state] = { sum: 0, count: 0 };
          totals[state].sum += premium;
          totals[state].count += 1;
        }

        const averages = Object.entries(totals)
          .map(([state, { sum, count }]) => ({ state, averagePremium: count ? sum / count : 0 }))
          .sort((a, b) => b.averagePremium - a.averagePremium);

        setData(averages);
      } catch (e) {
        setError(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchPremiums();
  }, []);

  if (loading) return <div>Loading…</div>;
  if (error) return <div>Error: {error}</div>;
  if (!Array.isArray(data) || data.length === 0) return <div>No data.</div>;

  return (
    <table>
      <thead>
        <tr><th>State</th><th>Average Premium</th></tr>
      </thead>
      <tbody>
        {data.map((d) => (
          <tr key={d.state}>
            <td>{d.state}</td>
            <td>{d.averagePremium.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
