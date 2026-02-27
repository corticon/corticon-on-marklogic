import json
import os
import sys
from typing import Any, Dict, List

def safe_int_str(hh_id: str) -> str:
    # keep as zero-padded numeric string if possible, else raw
    try:
        n = int(str(hh_id).strip())
        return str(n)
    except Exception:
        return str(hh_id).strip()

def main(input_path: str, out_dir: str) -> int:
    os.makedirs(out_dir, exist_ok=True)

    with open(input_path, "r", encoding="utf-8") as f:
        root = json.load(f)

    objects: List[Dict[str, Any]] = root.get("Objects") or []
    if not isinstance(objects, list):
        raise ValueError("Expected top-level Objects to be an array")

    written = 0
    for obj in objects:
        household = (obj or {}).get("household") or {}
        hh_id = household.get("householdId")
        if hh_id is None:
            continue

        hh_id_norm = safe_int_str(hh_id)
        out_doc = {
            "householdId": hh_id_norm,
            "familyName": household.get("familyName"),
            "application": obj,  # original object (channel, household, __metadata, etc.)
        }

        # Helpful: include top-level Messages metadata once (optional)
        # You can comment these out if you want smaller docs
        if "Messages" in root:
            out_doc["messages"] = root.get("Messages")

        # URI-friendly file name
        fname = f"household-{int(hh_id_norm):03d}.json" if hh_id_norm.isdigit() else f"household-{hh_id_norm}.json"
        out_path = os.path.join(out_dir, fname)

        with open(out_path, "w", encoding="utf-8") as wf:
            json.dump(out_doc, wf, ensure_ascii=False)

        written += 1

    print(f"Wrote {written} household output docs to: {out_dir}")
    return 0

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python split_output.py <sample-output.json> <out_dir>")
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2]))
