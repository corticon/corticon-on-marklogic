import { useCallback, useContext, useMemo, useState } from "react";
import { MarkLogicContext, SearchBox, SelectedFacets, StringFacet } from "ml-fasttrack";
import PolicyCard from "./PolicyCard";
import { getPolicyPayload, normalizeList } from "../utils/policyUtils";

const facetSections = [
  { name: "state", title: "State" },
  { name: "paymentPlan", title: "Payment plan" },
  { name: "incidentType", title: "Incident type" },
  { name: "bodyStyle", title: "Body style" }
];

export default function PolicySearch({ onSearch, selectedPolicyId }) {
  const context = useContext(MarkLogicContext);
  const [query, setQuery] = useState("");

  const resultRows = useMemo(() => {
    return normalizeList(context.searchResponse?.results)
      .map((result) => ({
        result,
        policyData: getPolicyPayload(result?.extracted?.content?.[0])
      }))
      .filter((row) => row.policyData);
  }, [context.searchResponse?.results]);

  const handleSearch = useCallback((params) => {
    const nextQuery = params?.q || "";
    setQuery(nextQuery);
    context.setQtext(nextQuery);
  }, [context]);

  const handleHintSearch = useCallback((nextQuery) => {
    setQuery(nextQuery);
    context.setQtext(nextQuery);
  }, [context]);

  const handleFacetSelect = useCallback((constraint) => {
    context.addStringFacetConstraint(constraint);
  }, [context]);

  const handleRemoveStringFacet = useCallback((facet, value) => {
    context.removeStringFacetConstraint(facet, value);
  }, [context]);

  const handleSelectPolicy = useCallback(async (result) => {
    try {
      const response = await context.getDocument(result.uri);
      onSearch(response?.data || response);
    } catch (err) {
      console.error("Failed to load selected policy", err);
    }
  }, [context, onSearch]);

  return (
    <div className="search-stack">
      <SearchBox
        value={query}
        onChange={setQuery}
        onSearch={handleSearch}
        placeholder="Try Virginia, Rivera, or APP-VALIDATE-20260422-01"
        ButtonProps={{ themeColor: "primary", fillMode: "solid" }}
        AutoCompleteProps={{ rounded: "large" }}
      />

      <div className="search-hints">
        <button onClick={() => handleHintSearch("Virginia")} className="ghost-chip">Virginia</button>
        <button onClick={() => handleHintSearch("Rivera")} className="ghost-chip">Rivera</button>
        <button onClick={() => handleHintSearch("APP-VALIDATE-20260422-01")} className="ghost-chip">APP-VALIDATE-20260422-01</button>
      </div>

      {context.searchResponseLoading ? <div className="search-feedback">Searching live policy outputs…</div> : null}

      <div className="search-surface">
        <div className="facet-column">
          <section className="widget-panel facet-panel selected-facets-panel">
            <div className="widget-heading compact">
              <div>
                <h3>Applied filters</h3>
                <p>Use the live FastTrack constraints to narrow the underwriting desk.</p>
              </div>
            </div>
            <SelectedFacets
              label="Selected facets"
              color="blue"
              dashed={true}
              stringFacets={context.stringFacetConstraints}
              rangeFacets={context.rangeFacetConstraints}
              removeStringFacet={handleRemoveStringFacet}
              removeRangeFacet={context.removeRangeFacetConstraint}
            />
          </section>

          {facetSections.map((facet) => (
            <section key={facet.name} className="widget-panel facet-panel">
              <StringFacet
                title={facet.title}
                name={facet.name}
                threshold={6}
                data={context.searchResponse?.facets?.[facet.name]}
                onSelect={handleFacetSelect}
                noValues="Run a search to load facet values."
              />
            </section>
          ))}
        </div>

        <div className="search-results-column">
          <div className="results-header">
            <strong>{context.searchResponse?.total || resultRows.length}</strong>
            <span>matching policies</span>
          </div>

          <div className="results-list">
            {resultRows.map(({ result, policyData }, index) => (
              <PolicyCard
                key={result.uri || policyData.applicationId || index}
                policyData={policyData}
                variant="compact"
                selected={selectedPolicyId === policyData.applicationId}
                onSelect={() => handleSelectPolicy(result)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}