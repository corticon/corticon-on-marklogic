import json
import os
import re
import sys
from typing import Any, Dict, List, Optional, Tuple

COA_ID_RE = re.compile(r"ClassOfAssistance_id_(\d+)", re.IGNORECASE)
PERSON_ID_RE = re.compile(r"Person_id_(\d+)", re.IGNORECASE)

def parse_meta_id(meta_id: Any, pattern: re.Pattern) -> Optional[int]:
    if not meta_id:
        return None
    s = str(meta_id)
    m = pattern.search(s)
    return int(m.group(1)) if m else None

def household_file_id(hh_id: str) -> str:
    return f"{int(hh_id):03d}" if str(hh_id).isdigit() else str(hh_id)

def build_coa_index(split_output_dir: str) -> Dict[int, Dict[str, Any]]:
    """
    Returns: entityId -> context { householdId, familyName, personId, personName, coaName, policyKey }
    """
    idx: Dict[int, Dict[str, Any]] = {}

    for fname in os.listdir(split_output_dir):
        if not fname.lower().endswith(".json"):
            continue
        path = os.path.join(split_output_dir, fname)
        with open(path, "r", encoding="utf-8") as f:
            doc = json.load(f)

        hh_id = str(doc.get("householdId") or "").strip()
        family = doc.get("familyName")
        app = doc.get("application") or {}
        household = (app.get("household") or {})
        persons = household.get("person") or []
        if not isinstance(persons, list):
            persons = [persons]

        for p in persons:
            pmeta = (p or {}).get("__metadata") or {}
            person_id = parse_meta_id(pmeta.get("#id"), PERSON_ID_RE)
            person_name = " ".join([str(p.get("first") or "").strip(), str(p.get("last") or "").strip()]).strip() or None

            coas = (p or {}).get("classOfAssistance") or []
            if not isinstance(coas, list):
                coas = [coas]

            for coa in coas:
                cmeta = (coa or {}).get("__metadata") or {}
                entity_id = parse_meta_id(cmeta.get("#id"), COA_ID_RE)
                if entity_id is None:
                    continue

                idx[entity_id] = {
                    "householdId": hh_id,
                    "familyName": family,
                    "personId": person_id,
                    "personName": person_name,
                    "coaName": coa.get("name"),
                    "policyKey": coa.get("policyKey"),
                }

    print(f"Built COA index for {len(idx)} ClassOfAssistance entityIds from split output.")
    return idx

def main(split_output_dir: str, trace_json_path: str, out_dir: str) -> int:
    os.makedirs(out_dir, exist_ok=True)

    coa_index = build_coa_index(split_output_dir)

    with open(trace_json_path, "r", encoding="utf-8") as f:
        trace_root = json.load(f)

    rows = trace_root.get("trace") or []
    if not isinstance(rows, list):
        raise ValueError("Expected trace-data.json to have a top-level 'trace' array")

    # Group trace rows by householdId after enrichment
    per_household: Dict[str, Dict[str, Any]] = {}

    unmatched = 0
    for row in rows:
        entity_type = row.get("entityType")
        entity_id = row.get("entityId")

        hh_id = None
        enrich = None

        if entity_type == "ClassOfAssistance" and isinstance(entity_id, int):
            enrich = coa_index.get(entity_id)
            if enrich:
                hh_id = enrich.get("householdId")

        if not hh_id:
            unmatched += 1
            continue

        bucket = per_household.get(hh_id)
        if not bucket:
            bucket = {
                "householdId": hh_id,
                "familyName": enrich.get("familyName") if enrich else None,
                "trace": [],
            }
            per_household[hh_id] = bucket

        # Add enrichment fields onto the trace row
        enriched_row = dict(row)
        if enrich:
            enriched_row["householdId"] = hh_id
            enriched_row["familyName"] = enrich.get("familyName")
            enriched_row["personId"] = enrich.get("personId")
            enriched_row["personName"] = enrich.get("personName")
            enriched_row["coaName"] = enrich.get("coaName")
            enriched_row["policyKey"] = enrich.get("policyKey")

        bucket["trace"].append(enriched_row)

    # Write one doc per household
    written = 0
    for hh_id, bucket in per_household.items():
        # Sort by sequence (numeric)
        bucket["trace"].sort(key=lambda r: int(r.get("sequence") or 0))
        bucket["rowCount"] = len(bucket["trace"])

        fname = f"household-{household_file_id(hh_id)}.json"
        out_path = os.path.join(out_dir, fname)
        with open(out_path, "w", encoding="utf-8") as wf:
            json.dump(bucket, wf, ensure_ascii=False)

        written += 1

    print(f"Wrote {written} household trace docs to: {out_dir}")
    print(f"Skipped {unmatched} trace rows that could not be linked via ClassOfAssistance entityId.")
    return 0

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python enrich_trace.py <split_output_dir> <trace-data.json> <out_dir>")
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2], sys.argv[3]))
