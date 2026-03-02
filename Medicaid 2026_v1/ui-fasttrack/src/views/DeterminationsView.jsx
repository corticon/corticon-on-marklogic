import { useCallback, useEffect, useMemo, useState } from "react";
import { SearchBox, DataGrid } from "ml-fasttrack";
import { Filter, FileText, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw } from "lucide-react";
import SectionCard from "../components/SectionCard";
import MetricCard from "../components/MetricCard";
import LoadingState from "../components/LoadingState";
import JsonPreview from "../components/JsonPreview";
import { debugLog, fetchJson } from "../lib/api";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function sameText(a, b) {
  return normalizeLower(a) === normalizeLower(b);
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function boolBadge(value) {
  if (value === null || value === undefined || value === "") return "—";
  return value ? "Yes" : "No";
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function tryParseJsonString(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return value;
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    return value;
  }
}

function looksLikeHouseholdDoc(value) {
  return Boolean(value && typeof value === "object" && (Array.isArray(value.person) || value.corticon || value.householdId || value._decisionLedger));
}

function normalizeLoadedDoc(rawValue, depth = 0) {
  if (depth > 4) return rawValue;
  if (rawValue === null || rawValue === undefined) return null;

  const parsed = tryParseJsonString(rawValue);
  if (parsed !== rawValue) return normalizeLoadedDoc(parsed, depth + 1);

  if (Array.isArray(rawValue)) {
    if (rawValue.length === 1) return normalizeLoadedDoc(rawValue[0], depth + 1);
    return rawValue;
  }

  if (typeof rawValue !== "object") return rawValue;
  if (looksLikeHouseholdDoc(rawValue)) return rawValue;

  // Common wrapper/envelope keys from clients/proxies.
  const candidateKeys = ["data", "document", "doc", "value", "content", "root", "body"];
  for (const key of candidateKeys) {
    if (rawValue[key] !== undefined) {
      const normalized = normalizeLoadedDoc(rawValue[key], depth + 1);
      if (looksLikeHouseholdDoc(normalized)) return normalized;
    }
  }

  // Some serializers wrap the actual document under "payload".
  if (rawValue.payload && typeof rawValue.payload === "object") {
    const payload = normalizeLoadedDoc(rawValue.payload, depth + 1);
    if (looksLikeHouseholdDoc(payload)) {
      return {
        ...payload,
        corticon: rawValue.corticon ?? payload.corticon,
        _decisionLedger: rawValue._decisionLedger ?? payload._decisionLedger
      };
    }
  }

  return rawValue;
}

function findPerson(doc, personName) {
  const people = toArray(doc?.person);
  if (!people.length) return null;
  if (!personName) return people[0];
  return people.find((p) => sameText(p?.fullName, personName))
    || people.find((p) => normalizeLower(p?.fullName).includes(normalizeLower(personName)))
    || people[0];
}

function getMemberList(doc) {
  return toArray(doc?.person).map((person) => ({
    fullName: person?.fullName || "(unnamed)",
    age: person?.age,
    sex: person?.sex || null,
    maritalStatus: person?.maritalStatus || null,
    relationToPolicyholder: person?.relationToPolicyholder || null
  }));
}

function pathwayRowsForPerson(person) {
  return toArray(person?.eligibilityPathway).map((pathway) => {
    const determination = toArray(pathway?.determination)[0] || {};
    return {
      pathway: pathway?.pathway || null,
      programCode: pathway?.programCode || null,
      assignedPathwayType: pathway?.assignedPathwayType || null,
      eligibility: determination?.eligibility || null,
      reasonCode: determination?.reasonCode || null,
      benefitScope: pathway?.benefitScope || null,
      netRecommendationScore: pathway?.netRecommendationScore || null,
      overlay: pathway?.overlay === true,
      autoEnroll: pathway?.autoEnroll === true
    };
  });
}

function populationTagsForPerson(person) {
  return toArray(person?.population).map((p) => p?.type).filter(Boolean);
}

function diffObjects(inputObj, outputObj) {
  const input = (inputObj && typeof inputObj === "object") ? inputObj : {};
  const output = (outputObj && typeof outputObj === "object") ? outputObj : {};
  const inputKeys = new Set(Object.keys(input));
  const added = [];
  const changed = [];

  Object.keys(output).forEach((key) => {
    const outVal = output[key];
    const inHas = inputKeys.has(key);
    const inVal = input[key];

    if (!inHas) {
      added.push({ key, type: Array.isArray(outVal) ? "array" : typeof outVal });
      return;
    }

    if (JSON.stringify(outVal) !== JSON.stringify(inVal)) {
      changed.push({ key, input: inVal, output: outVal });
    }
  });

  added.sort((a, b) => a.key.localeCompare(b.key));
  changed.sort((a, b) => a.key.localeCompare(b.key));
  return { added, changed };
}

function metricsSummary(doc) {
  const metrics = doc?.corticon?.Metrics || {};
  const attributeChanges = toArray(metrics.attributeChanges);
  const associationChanges = toArray(metrics.associationChanges);
  const entityChanges = toArray(metrics.entityChanges);
  const combined = [...attributeChanges, ...associationChanges, ...entityChanges];

  const byRulesheet = new Map();
  combined.forEach((entry) => {
    const normalized = String(entry?.rulesheetName || "(unknown)").replace(/\\/g, "/");
    const shortName = normalized.split("/").pop() || normalized;
    const current = byRulesheet.get(shortName) || { rulesheet: shortName, count: 0 };
    current.count += 1;
    byRulesheet.set(shortName, current);
  });

  return {
    attributeChanges: attributeChanges.length,
    associationChanges: associationChanges.length,
    entityChanges: entityChanges.length,
    totalChanges: combined.length,
    topRulesheets: Array.from(byRulesheet.values())
      .sort((a, b) => b.count - a.count || a.rulesheet.localeCompare(b.rulesheet))
      .slice(0, 8)
  };
}

function topScalarFields(person) {
  if (!person) return [];
  return [
    ["Full Name", person.fullName],
    ["Age", person.age],
    ["Age Category", person.ageCategory],
    ["Sex", person.sex],
    ["Marital Status", person.maritalStatus],
    ["Relation to Policyholder", person.relationToPolicyholder],
    ["Parent/Caretaker", person.isParentOrCaretaker],
    ["Has Dependent Child", person.hasDependentChild],
    ["Filing Status", person.filingStatus],
    ["Citizenship", person.citizenshipStatus],
    ["Residence State", person.currentResidenceState],
    ["Household MAGI % FPL", person.householdMagiIncomePctFPL],
    ["Household Resources", person.householdResources],
    ["Countable Monthly Income", person.countableMonthlyIncome],
    ["Countable Resources", person.countableResources],
    ["Disability Status", person.disabilityStatus],
    ["Current Foster Care", person.currentFosterCare],
    ["Receives Title IV-E", person.receivesTitleIVE]
  ];
}

export default function DeterminationsView({ proxyBaseUrl }) {
  const [queryText, setQueryText] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageLength, setPageLength] = useState(15);
  const [sortBy, setSortBy] = useState("person_full_name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [filters, setFilters] = useState({
    state: "",
    eligibility: "",
    reasonCode: "",
    populationType: "",
    programCode: "",
    assignedPathwayType: "",
    personName: "",
    sex: "",
    maritalStatus: "",
    ageCategory: "",
    relationToPolicyholder: "",
    isParentOrCaretaker: "",
    hasDependentChild: "",
    isMarried: "",
    minAge: "",
    maxAge: ""
  });
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedInputDoc, setSelectedInputDoc] = useState(null);
  const [selectedOutputDoc, setSelectedOutputDoc] = useState(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState("");
  const [activeMemberName, setActiveMemberName] = useState("");

  const loadDeterminations = useCallback((signal) => {
    setLoading(true);
    setError("");
    const started = performance.now();
    const queryParams = {
      "rs:page": page,
      "rs:pageLength": pageLength,
      "rs:sortBy": sortBy,
      "rs:sortDirection": sortDirection,
      "rs:q": searchQ,
      "rs:state": filters.state,
      "rs:eligibility": filters.eligibility,
      "rs:reasonCode": filters.reasonCode,
      "rs:populationType": filters.populationType,
      "rs:programCode": filters.programCode,
      "rs:assignedPathwayType": filters.assignedPathwayType,
      "rs:personName": filters.personName,
      "rs:sex": filters.sex,
      "rs:maritalStatus": filters.maritalStatus,
      "rs:ageCategory": filters.ageCategory,
      "rs:relationToPolicyholder": filters.relationToPolicyholder,
      "rs:isParentOrCaretaker": filters.isParentOrCaretaker,
      "rs:hasDependentChild": filters.hasDependentChild,
      "rs:isMarried": filters.isMarried,
      "rs:minAge": filters.minAge,
      "rs:maxAge": filters.maxAge
    };
    debugLog("determinations", "Loading rows", queryParams);
    return fetchJson(proxyBaseUrl, "/v1/resources/eligibilityDeterminations", queryParams, { signal })
      .then((data) => {
        debugLog("determinations", `Loaded rows in ${Math.round(performance.now() - started)}ms`, {
          total: data?.total,
          page: data?.page,
          pageLength: data?.pageLength,
          warnings: data?.warnings || []
        });
        setResponse(data);
        setLoading(false);
        setSelectedRow((prev) => {
          if (!data?.rows?.length) return null;
          if (prev) {
            const matched = data.rows.find((row) =>
              row.correlation_id === prev.correlation_id &&
              row.person_full_name === prev.person_full_name &&
              row.pathway === prev.pathway &&
              row.reason_code === prev.reason_code
            );
            if (matched) return matched;
          }
          return data.rows[0];
        });
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        debugLog("determinations", `Load failed in ${Math.round(performance.now() - started)}ms`, {
          error: e.message,
          payload: e.payload
        });
        setError(e.message || "Failed to load determinations");
        setLoading(false);
      });
  }, [
    proxyBaseUrl,
    page,
    pageLength,
    sortBy,
    sortDirection,
    searchQ,
    filters.state,
    filters.eligibility,
    filters.reasonCode,
    filters.populationType,
    filters.programCode,
    filters.assignedPathwayType,
    filters.personName,
    filters.sex,
    filters.maritalStatus,
    filters.ageCategory,
    filters.relationToPolicyholder,
    filters.isParentOrCaretaker,
    filters.hasDependentChild,
    filters.isMarried,
    filters.minAge,
    filters.maxAge,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    loadDeterminations(controller.signal);
    return () => controller.abort();
  }, [loadDeterminations]);

  useEffect(() => {
    if (!selectedRow) {
      setActiveMemberName("");
      setSelectedInputDoc(null);
      setSelectedOutputDoc(null);
      return;
    }
    setActiveMemberName(selectedRow.person_full_name || "");
  }, [selectedRow]);

  useEffect(() => {
    if (!selectedRow?.output_payload_uri) {
      setSelectedInputDoc(null);
      setSelectedOutputDoc(null);
      return;
    }

    let cancelled = false;
    setDocLoading(true);
    setDocError("");
    const started = performance.now();
    debugLog("determinations", "Loading selected linked documents", {
      inputUri: selectedRow.input_payload_uri,
      outputUri: selectedRow.output_payload_uri
    });

    const controller = new AbortController();
    const loadDoc = (uri) => {
      if (!uri) return Promise.resolve(null);
      return fetchJson(proxyBaseUrl, "/v1/documents", { uri, format: "json" }, { signal: controller.signal })
        .then((doc) => normalizeLoadedDoc(doc));
    };

    Promise.all([loadDoc(selectedRow.input_payload_uri), loadDoc(selectedRow.output_payload_uri)])
      .then(([inputDoc, outputDoc]) => {
        if (cancelled) return;
        debugLog("determinations", `Loaded selected linked documents in ${Math.round(performance.now() - started)}ms`, {
          inputUri: selectedRow.input_payload_uri,
          outputUri: selectedRow.output_payload_uri
        });
        setSelectedInputDoc(inputDoc);
        setSelectedOutputDoc(outputDoc);
        debugLog("determinations", "Resolved linked document shapes", {
          inputType: inputDoc ? typeof inputDoc : "null",
          inputHasPeople: Array.isArray(inputDoc?.person),
          outputType: outputDoc ? typeof outputDoc : "null",
          outputHasPeople: Array.isArray(outputDoc?.person),
          outputHasTrace: Boolean(outputDoc?.corticon?.Metrics)
        });
        setDocLoading(false);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        if (cancelled) return;
        debugLog("determinations", `Linked documents load failed in ${Math.round(performance.now() - started)}ms`, {
          inputUri: selectedRow.input_payload_uri,
          outputUri: selectedRow.output_payload_uri,
          error: e.message
        });
        setDocError(e.message || "Unable to load linked input/output documents");
        setDocLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedRow, proxyBaseUrl]);

  const rows = toArray(response?.rows);
  const facets = response?.facets || {};
  const hasTdeGap = rows.some((row) => !row.person_full_name || !row.pathway || !row.reason_code);

  useEffect(() => {
    if (!selectedRow) return;
    debugLog("determinations", "Row selected", {
      householdId: selectedRow.household_id,
      eligibility: selectedRow.eligibility,
      reasonCode: selectedRow.reason_code,
      outputUri: selectedRow.output_payload_uri
    });
  }, [selectedRow]);

  const summaryCounts = useMemo(() => {
    const eligibilityFacet = toArray(facets.eligibility);
    const eligible = eligibilityFacet.find((x) => x.value === "Eligible")?.count || 0;
    const ineligible = eligibilityFacet.find((x) => x.value === "Ineligible")?.count || 0;
    const married = toArray(facets.maritalStatus)
      .filter((x) => {
        const v = String(x.value || "").toLowerCase();
        return v.includes("married") && !v.includes("never married");
      })
      .reduce((sum, x) => sum + (x.count || 0), 0);
    return {
      total: response?.total || 0,
      eligible,
      ineligible,
      states: toArray(facets.state).length,
      married,
      householdsOnPage: new Set(rows.map((r) => `${r.correlation_id || ""}|${r.household_id || ""}`)).size
    };
  }, [facets, response, rows]);

  const memberList = useMemo(() => getMemberList(selectedOutputDoc || selectedInputDoc), [selectedOutputDoc, selectedInputDoc]);
  const activeInputPerson = useMemo(() => findPerson(selectedInputDoc, activeMemberName || selectedRow?.person_full_name), [selectedInputDoc, activeMemberName, selectedRow]);
  const activeOutputPerson = useMemo(() => findPerson(selectedOutputDoc, activeMemberName || selectedRow?.person_full_name), [selectedOutputDoc, activeMemberName, selectedRow]);
  const activePathways = useMemo(() => pathwayRowsForPerson(activeOutputPerson), [activeOutputPerson]);
  const activePopulationTags = useMemo(() => populationTagsForPerson(activeOutputPerson), [activeOutputPerson]);
  const memberDiff = useMemo(() => diffObjects(activeInputPerson, activeOutputPerson), [activeInputPerson, activeOutputPerson]);
  const householdDiff = useMemo(() => diffObjects(selectedInputDoc, selectedOutputDoc), [selectedInputDoc, selectedOutputDoc]);
  const traceSummary = useMemo(() => metricsSummary(selectedOutputDoc), [selectedOutputDoc]);

  const selectedRowMatchesActiveMember = sameText(selectedRow?.person_full_name, activeMemberName);

  const reasonDrillRows = useMemo(() => {
    const items = activePathways.filter((path) => path.pathway || path.reasonCode || path.programCode);
    return items.sort((a, b) => {
      const aMatch = selectedRowMatchesActiveMember && sameText(a.pathway, selectedRow?.pathway) && sameText(a.reasonCode, selectedRow?.reason_code);
      const bMatch = selectedRowMatchesActiveMember && sameText(b.pathway, selectedRow?.pathway) && sameText(b.reasonCode, selectedRow?.reason_code);
      if (aMatch !== bMatch) return aMatch ? -1 : 1;
      const an = numberOrNull(a.netRecommendationScore);
      const bn = numberOrNull(b.netRecommendationScore);
      if (an !== null && bn !== null && an !== bn) return bn - an;
      return normalizeText(a.pathway).localeCompare(normalizeText(b.pathway));
    });
  }, [activePathways, selectedRow, selectedRowMatchesActiveMember]);

  const gridColumns = useMemo(() => ([
    {
      title: "",
      width: "88px",
      cells: {
        data: (props) => (
          <td>
            <button
              type="button"
              className="inline-action"
              onClick={(event) => {
                event.stopPropagation();
                setSelectedRow(props.dataItem);
              }}
            >
              Inspect
            </button>
          </td>
        )
      }
    },
    {
      field: "person_full_name",
      title: "Person",
      width: "250px",
      cells: {
        data: (props) => {
          const row = props.dataItem;
          return (
            <td>
              <div className="cell-stack">
                <div className="cell-title">{row.person_full_name || "—"}</div>
                <div className="cell-sub">Age {displayValue(row.person_age)} • {displayValue(row.person_sex)} • {displayValue(row.person_marital_status)}</div>
                <div className="cell-sub">{displayValue(row.person_relation_to_policyholder)}</div>
              </div>
            </td>
          );
        }
      }
    },
    {
      field: "eligibility",
      title: "Determination",
      width: "250px",
      cells: {
        data: (props) => {
          const row = props.dataItem;
          const isIneligible = String(row.eligibility || "").toLowerCase() === "ineligible";
          return (
            <td>
              <div className="cell-stack">
                <div>
                  <span className={`badge ${isIneligible ? "badge-danger" : "badge-success"}`}>{row.eligibility || "—"}</span>
                </div>
                <div className="cell-sub mono wrap">{row.reason_code || "—"}</div>
              </div>
            </td>
          );
        }
      }
    },
    {
      field: "pathway",
      title: "Pathway",
      width: "350px",
      cells: {
        data: (props) => {
          const row = props.dataItem;
          return (
            <td>
              <div className="cell-stack">
                <div className="cell-title wrap">{row.pathway || "—"}</div>
                <div className="cell-sub mono">{row.program_code || "—"}</div>
                <div className="chip-row wrap-row">
                  {row.assigned_pathway_type ? <span className="mini-chip">{row.assigned_pathway_type}</span> : null}
                  {row.household_magi_income_pct_fpl !== undefined && row.household_magi_income_pct_fpl !== null && row.household_magi_income_pct_fpl !== "" ? (
                    <span className="mini-chip muted">FPL {row.household_magi_income_pct_fpl}%</span>
                  ) : null}
                </div>
              </div>
            </td>
          );
        }
      }
    },
    {
      field: "population_types",
      title: "Cohorts / Role",
      width: "300px",
      cells: {
        data: (props) => {
          const row = props.dataItem;
          const tags = toArray(row.population_types);
          return (
            <td>
              <div className="cell-stack">
                <div className="chip-row wrap-row">
                  {tags.slice(0, 4).map((tag) => <span className="mini-chip" key={tag}>{tag}</span>)}
                  {tags.length > 4 ? <span className="mini-chip muted">+{tags.length - 4}</span> : null}
                </div>
                <div className="cell-sub">
                  Parent/Caretaker: <strong>{boolBadge(row.person_is_parent_or_caretaker)}</strong> • Dep Child: <strong>{boolBadge(row.person_has_dependent_child)}</strong>
                </div>
              </div>
            </td>
          );
        }
      }
    },
    {
      field: "household_id",
      title: "Household",
      width: "180px",
      cells: {
        data: (props) => {
          const row = props.dataItem;
          return (
            <td>
              <div className="cell-stack compact">
                <div className="cell-sub">{row.household_state || "—"}</div>
                <div className="cell-title">{row.household_id || "—"}</div>
                <div className="cell-sub">Members {displayValue(row.person_count)}</div>
              </div>
            </td>
          );
        }
      }
    }
  ]), []);

  return (
    <div className="view-stack">
      <SectionCard
        title="Eligibility Determinations Explorer"
        subtitle="Person-centered explorer for explainable Medicaid outcomes, with household context and pathway drilldown."
        actions={(
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              debugLog("determinations", "Manual refresh requested");
              loadDeterminations();
            }}
            disabled={loading}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        )}
      >
        <div className="controls-grid explorer-controls-top">
          <div className="search-box-wrap">
            <SearchBox
              value={queryText}
              onChange={setQueryText}
              onSearch={(params) => {
                debugLog("determinations", "Search submitted", { params, queryText });
                setPage(1);
                setSearchQ((params && params.q) || queryText || "");
              }}
              placeholder="Search person, household, pathway, program, reason code..."
              searchSuggest={false}
              ButtonProps={{ themeColor: "primary" }}
              AutoCompleteProps={{ clearButton: true }}
            />
          </div>
          <label>
            <span>Person Name</span>
            <input
              type="text"
              value={filters.personName}
              onChange={(e) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, personName: e.target.value }));
              }}
              placeholder="e.g. Savary"
            />
          </label>
          <label>
            <span>State</span>
            <select
              value={filters.state}
              onChange={(e) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, state: e.target.value }));
              }}
            >
              <option value="">All states</option>
              {toArray(facets.state).map((item) => (
                <option key={item.value} value={item.value}>{item.value} ({item.count})</option>
              ))}
            </select>
          </label>
          <label>
            <span>Eligibility</span>
            <select
              value={filters.eligibility}
              onChange={(e) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, eligibility: e.target.value }));
              }}
            >
              <option value="">All</option>
              {toArray(facets.eligibility).map((item) => (
                <option key={item.value} value={item.value}>{item.value} ({item.count})</option>
              ))}
            </select>
          </label>
          <label>
            <span>Population</span>
            <select
              value={filters.populationType}
              onChange={(e) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, populationType: e.target.value }));
              }}
            >
              <option value="">All populations</option>
              {toArray(facets.populationType).slice(0, 50).map((item) => (
                <option key={item.value} value={item.value}>{item.value} ({item.count})</option>
              ))}
            </select>
          </label>
          <label>
            <span>Program</span>
            <select
              value={filters.programCode}
              onChange={(e) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, programCode: e.target.value }));
              }}
            >
              <option value="">All programs</option>
              {toArray(facets.programCode).slice(0, 80).map((item) => (
                <option key={item.value} value={item.value}>{item.value} ({item.count})</option>
              ))}
            </select>
          </label>
        </div>

        <div className="controls-grid explorer-controls-bottom">
          <label>
            <span>Assigned Type</span>
            <select
              value={filters.assignedPathwayType}
              onChange={(e) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, assignedPathwayType: e.target.value }));
              }}
            >
              <option value="">All</option>
              {toArray(facets.assignedPathwayType).map((item) => (
                <option key={item.value} value={item.value}>{item.value} ({item.count})</option>
              ))}
            </select>
          </label>
          <label>
            <span>Reason Code</span>
            <select
              value={filters.reasonCode}
              onChange={(e) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, reasonCode: e.target.value }));
              }}
            >
              <option value="">All reasons</option>
              {toArray(facets.reasonCode).slice(0, 120).map((item) => (
                <option key={item.value} value={item.value}>{item.value} ({item.count})</option>
              ))}
            </select>
          </label>
          <label>
            <span>Marital Status</span>
            <select
              value={filters.maritalStatus}
              onChange={(e) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, maritalStatus: e.target.value }));
              }}
            >
              <option value="">All</option>
              {toArray(facets.maritalStatus).map((item) => (
                <option key={item.value} value={item.value}>{item.value} ({item.count})</option>
              ))}
            </select>
          </label>
          <label>
            <span>Married Filter</span>
            <select
              value={filters.isMarried}
              onChange={(e) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, isMarried: e.target.value }));
              }}
            >
              <option value="">Any</option>
              <option value="true">Married only</option>
              <option value="false">Not married only</option>
            </select>
          </label>
          <label>
            <span>Age Category</span>
            <select
              value={filters.ageCategory}
              onChange={(e) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, ageCategory: e.target.value }));
              }}
            >
              <option value="">All age bands</option>
              {toArray(facets.ageCategory).map((item) => (
                <option key={item.value} value={item.value}>{item.value} ({item.count})</option>
              ))}
            </select>
          </label>
          <label>
            <span>Relation</span>
            <select
              value={filters.relationToPolicyholder}
              onChange={(e) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, relationToPolicyholder: e.target.value }));
              }}
            >
              <option value="">All relations</option>
              {toArray(facets.relationToPolicyholder).slice(0, 50).map((item) => (
                <option key={item.value} value={item.value}>{item.value} ({item.count})</option>
              ))}
            </select>
          </label>
          <label>
            <span>Parent/Caretaker</span>
            <select
              value={filters.isParentOrCaretaker}
              onChange={(e) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, isParentOrCaretaker: e.target.value }));
              }}
            >
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          <label>
            <span>Has Dependent Child</span>
            <select
              value={filters.hasDependentChild}
              onChange={(e) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, hasDependentChild: e.target.value }));
              }}
            >
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          <label>
            <span>Sex</span>
            <select
              value={filters.sex}
              onChange={(e) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, sex: e.target.value }));
              }}
            >
              <option value="">All</option>
              {toArray(facets.sex).map((item) => (
                <option key={item.value} value={item.value}>{item.value} ({item.count})</option>
              ))}
            </select>
          </label>
          <label>
            <span>Min Age</span>
            <input
              type="number"
              min="0"
              value={filters.minAge}
              onChange={(e) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, minAge: e.target.value }));
              }}
              placeholder="0"
            />
          </label>
          <label>
            <span>Max Age</span>
            <input
              type="number"
              min="0"
              value={filters.maxAge}
              onChange={(e) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, maxAge: e.target.value }));
              }}
              placeholder="120"
            />
          </label>
          <label>
            <span>Sort</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="person_full_name">Person Name</option>
              <option value="person_age">Age</option>
              <option value="household_state">State</option>
              <option value="eligibility">Eligibility</option>
              <option value="reason_code">Reason Code</option>
              <option value="program_code">Program</option>
              <option value="pathway">Pathway</option>
              <option value="assigned_pathway_type">Assigned Type</option>
              <option value="person_marital_status">Marital Status</option>
              <option value="household_magi_income_pct_fpl">Household FPL %</option>
              <option value="household_id">Household ID</option>
            </select>
          </label>
          <label>
            <span>Direction</span>
            <select value={sortDirection} onChange={(e) => setSortDirection(e.target.value)}>
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
          <label>
            <span>Rows / Page</span>
            <select
              value={pageLength}
              onChange={(e) => {
                setPage(1);
                setPageLength(Number(e.target.value));
              }}
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>

        <div className="inline-note">
          <Filter size={14} />
          <span>
            {response ? `${response.total} person-level determination rows` : "Loading rows..."}
            {searchQ ? ` • text "${searchQ}"` : ""}
            {filters.personName ? ` • person "${filters.personName}"` : ""}
            {filters.isMarried === "true" ? " • married only" : ""}
          </span>
        </div>
      </SectionCard>

      <div className="metric-grid">
        <MetricCard title="Determination Rows" value={summaryCounts.total} accent="blue" />
        <MetricCard title="Eligible" value={summaryCounts.eligible} accent="green" />
        <MetricCard title="Ineligible" value={summaryCounts.ineligible} accent="red" />
        <MetricCard
          title="Married (Result Set)"
          value={summaryCounts.married}
          accent="slate"
          subtitle={`${summaryCounts.states} states • ${summaryCounts.householdsOnPage} households on page`}
        />
      </div>

      {hasTdeGap ? (
        <div className="warning-banner">
          <AlertTriangle size={16} />
          <div>
            Some person/pathway fields are missing on a subset of rows. The right panel still resolves explainability details
            from linked input/output payloads for the selected row.
          </div>
        </div>
      ) : null}

      <div className="two-column-layout">
        <SectionCard title="Person Determination Results" subtitle="Rows are organized by household member and determination outcome; household ID is secondary context." className="wide">
          {loading ? (
            <LoadingState label="Loading eligibility determinations..." />
          ) : error ? (
            <div className="error-panel">{error}</div>
          ) : (
            <>
              <DataGrid
                data={rows}
                gridColumns={gridColumns}
                paginationHeader={false}
                paginationFooter={false}
                GridProps={{
                  style: { maxHeight: 560, minHeight: 500 },
                  onRowClick: (event) => setSelectedRow(event.dataItem)
                }}
              />
              <div className="pager-bar">
                <div>
                  Page {response?.page || page} of {response?.totalPages || 1}
                </div>
                <div className="pager-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={(response?.page || page) <= 1 || loading}
                  >
                    <ChevronLeft size={14} />
                    Prev
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setPage((p) => Math.min((response?.totalPages || p), p + 1))}
                    disabled={(response?.page || page) >= (response?.totalPages || 1) || loading}
                  >
                    Next
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard title="Explainability Drilldown" subtitle="Navigate by household member and compare input vs response payload details for the selected decision row." className="narrow">
          {selectedRow ? (
            <div className="detail-stack">
              <div className="detail-block">
                <div className="detail-label">Selected Determination</div>
                <div className="detail-value">{selectedRow.person_full_name || "—"}</div>
                <div className="detail-muted">{selectedRow.household_state || "—"} • {selectedRow.household_id || "—"} • Household members: {displayValue(selectedRow.person_count)}</div>
              </div>
              <div className="detail-grid">
                <div>
                  <div className="detail-label">Eligibility</div>
                  <div className={`badge ${String(selectedRow.eligibility || "").toLowerCase() === "ineligible" ? "badge-danger" : "badge-success"}`}>
                    {selectedRow.eligibility || "—"}
                  </div>
                </div>
                <div>
                  <div className="detail-label">Reason Code</div>
                  <div className="detail-value mono wrap">{selectedRow.reason_code || "—"}</div>
                </div>
              </div>
              <div className="detail-block">
                <div className="detail-label">Pathway (Row Context)</div>
                <div className="detail-value wrap">{selectedRow.pathway || "—"}</div>
                <div className="detail-muted mono">{selectedRow.program_code || "—"} {selectedRow.assigned_pathway_type ? `• ${selectedRow.assigned_pathway_type}` : ""}</div>
              </div>
              <div className="detail-block">
                <div className="detail-label">Household Member Navigator</div>
                <div className="member-nav">
                  {memberList.length ? memberList.map((member) => (
                    <button
                      type="button"
                      key={member.fullName}
                      className={`member-chip ${sameText(member.fullName, activeMemberName) ? "active" : ""}`}
                      onClick={() => setActiveMemberName(member.fullName)}
                    >
                      <span className="member-chip-title">{member.fullName}</span>
                      <span className="member-chip-sub">Age {displayValue(member.age)} • {displayValue(member.sex)} • {displayValue(member.relationToPolicyholder)}</span>
                    </button>
                  )) : (
                    <div className="empty-inline">No household members resolved yet.</div>
                  )}
                </div>
              </div>
              <div className="detail-block">
                <div className="detail-label">Selected Member Input Context</div>
                {activeInputPerson ? (
                  <div className="kv-grid">
                    {topScalarFields(activeInputPerson).map(([label, value]) => (
                      <div className="kv-item" key={label}>
                        <div className="kv-label">{label}</div>
                        <div className="kv-value">{displayValue(value)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-inline">Input person profile not found for this row.</div>
                )}
              </div>
              <div className="detail-block">
                <div className="detail-label">Population Tags (Selected Member)</div>
                <div className="tag-list">
                  {activePopulationTags.length ? activePopulationTags.map((tag) => (
                    <span className="tag" key={tag}>{tag}</span>
                  )) : <span className="empty-inline">No population tags found.</span>}
                </div>
              </div>
              <div className="detail-block">
                <div className="detail-label">Pathway / Reason Drilldown ({activeMemberName || "Selected member"})</div>
                {reasonDrillRows.length ? (
                  <div className="table-wrap">
                    <table className="data-table compact-table">
                      <thead>
                        <tr>
                          <th>Pathway</th>
                          <th>Assigned</th>
                          <th>Eligibility</th>
                          <th>Reason</th>
                          <th className="num">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reasonDrillRows.map((row, idx) => {
                          const isSelectedMatch =
                            selectedRowMatchesActiveMember &&
                            sameText(row.pathway, selectedRow.pathway) &&
                            sameText(row.reasonCode, selectedRow.reason_code);
                          return (
                            <tr key={`${row.pathway || "path"}-${row.reasonCode || "reason"}-${idx}`} className={isSelectedMatch ? "highlight-row" : ""}>
                              <td>
                                <div className="cell-stack compact">
                                  <div className="cell-title wrap">{row.pathway || "—"}</div>
                                  <div className="cell-sub mono">{row.programCode || "—"}</div>
                                </div>
                              </td>
                              <td>{row.assignedPathwayType || (row.overlay ? "Overlay" : "—")}</td>
                              <td>{row.eligibility || "—"}</td>
                              <td className="mono wrap">{row.reasonCode || "—"}</td>
                              <td className="num">{displayValue(row.netRecommendationScore)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-inline">No pathway rows found for the selected member.</div>
                )}
              </div>
              <div className="detail-block">
                <div className="detail-label">Response Additions vs Input (Selected Member)</div>
                <div className="detail-muted">Fields added or changed in the output person payload relative to the input household payload.</div>
                <div className="compare-grid">
                  <div>
                    <div className="subsection-title">Added Fields</div>
                    {memberDiff.added.length ? (
                      <div className="table-wrap slim-table-wrap">
                        <table className="data-table compact-table">
                          <thead>
                            <tr><th>Field</th><th>Type</th></tr>
                          </thead>
                          <tbody>
                            {memberDiff.added.map((item) => (
                              <tr key={item.key}>
                                <td className="mono wrap">{item.key}</td>
                                <td>{item.type}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <div className="empty-inline">No added fields.</div>}
                  </div>
                  <div>
                    <div className="subsection-title">Changed Fields</div>
                    {memberDiff.changed.length ? (
                      <div className="table-wrap slim-table-wrap">
                        <table className="data-table compact-table">
                          <thead>
                            <tr><th>Field</th><th>Input</th><th>Output</th></tr>
                          </thead>
                          <tbody>
                            {memberDiff.changed.slice(0, 40).map((item) => (
                              <tr key={item.key}>
                                <td className="mono wrap">{item.key}</td>
                                <td className="wrap">{typeof item.input === "object" ? "(complex)" : displayValue(item.input)}</td>
                                <td className="wrap">{typeof item.output === "object" ? "(complex)" : displayValue(item.output)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <div className="empty-inline">No changed fields.</div>}
                  </div>
                </div>
              </div>
              <div className="detail-block">
                <div className="detail-label">Household-Level Response Additions</div>
                <div className="chip-row wrap-row">
                  {householdDiff.added.length ? householdDiff.added.map((item) => (
                    <span className="mini-chip muted" key={item.key}>{item.key}</span>
                  )) : <span className="empty-inline">No top-level additions.</span>}
                </div>
              </div>
              <div className="detail-block">
                <div className="detail-label">Rule Trace Snapshot</div>
                <div className="detail-grid">
                  <div className="metric-tile-inline">
                    <div className="detail-label">Attr</div>
                    <div className="detail-value">{traceSummary.attributeChanges}</div>
                  </div>
                  <div className="metric-tile-inline">
                    <div className="detail-label">Assoc</div>
                    <div className="detail-value">{traceSummary.associationChanges}</div>
                  </div>
                  <div className="metric-tile-inline">
                    <div className="detail-label">Entity</div>
                    <div className="detail-value">{traceSummary.entityChanges}</div>
                  </div>
                  <div className="metric-tile-inline">
                    <div className="detail-label">Total</div>
                    <div className="detail-value">{traceSummary.totalChanges}</div>
                  </div>
                </div>
                {traceSummary.topRulesheets.length ? (
                  <div className="list-rows top-space">
                    {traceSummary.topRulesheets.map((item) => (
                      <div className="list-row" key={item.rulesheet}>
                        <span className="wrap">{item.rulesheet}</span>
                        <span className="subtle">{item.count} events</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="detail-block">
                <div className="detail-label">Linked Documents</div>
                <div className="detail-muted mono wrap">Input: {selectedRow.input_payload_uri || "—"}</div>
                <div className="detail-muted mono wrap">Output: {selectedRow.output_payload_uri || "—"}</div>
              </div>
              <div className="detail-block">
                <div className="detail-label">Input / Output Payload Preview</div>
                {docLoading ? <LoadingState label="Loading linked documents..." /> : null}
                {docError ? <div className="error-panel compact">{docError}</div> : null}
                {!docLoading && !docError ? (
                  <div className="json-compare-grid">
                    <div>
                      <div className="subsection-title">Input Household</div>
                      <JsonPreview value={selectedInputDoc || { note: "No input document" }} maxHeight={220} />
                    </div>
                    <div>
                      <div className="subsection-title">Output Household</div>
                      <JsonPreview value={selectedOutputDoc || { note: "No output document" }} maxHeight={220} />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="empty-panel">
              <FileText size={26} />
              <p>Select a row to inspect member-level explainability details and linked decision ledger documents.</p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
