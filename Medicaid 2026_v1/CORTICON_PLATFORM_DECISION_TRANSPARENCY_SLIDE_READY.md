# Corticon.js + Platform: Explainable Decisions at Scale (Slide-Ready)

## Slide 1: Why This Matters

- Medicaid eligibility decisions are complex, high-impact, and policy-driven
- Teams need more than a final answer; they need to understand why a result occurred
- Transparency improves service delivery, trust, auditability, and policy analysis

## Slide 2: Role of the `corticon.js` Decision Service

- Executes Medicaid eligibility logic consistently for each household/person
- Evaluates multiple eligibility pathways
- Produces determinations and the logic evidence behind them
- Serves as the explainable decision engine in the workflow

## Slide 3: What `corticon.js` Exposes (Beyond a Final Outcome)

- Final determination and selected pathway
- Pathways evaluated but not selected
- Rule trace details (met / not met / skipped conditions)
- Derived values used in decisions (income, resources, FPL comparisons, age categories, residency, etc.)
- Reason-level explanations tied to facts and thresholds
- Decision version context (which rule set/logic bundle was used)

## Slide 4: Why This Is Hard in Less Transparent Automation

- Many systems return only an outcome + reason code
- Limited ability to reconstruct exactly why a pathway failed
- Difficult to audit past decisions after policy or logic changes
- Hard to identify recurring barriers across populations

## Slide 5: What the Platform Adds

- Organizes granular decision outputs into a usable data foundation
- Connects decision evidence to person/household/context data
- Preserves history across time and logic versions
- Makes detailed decision evidence queryable at scale

## Slide 6: From Individual Case Review to Population Insight

- Case-level: "Why was this person denied or approved?"
- Program-level: "What barriers are repeatedly driving coverage loss or delay?"
- Policy-level: "Who would be impacted if a threshold or rule changes?"

## Slide 7: Why the Platform Enables Better Service Delivery

- Identifies addressable barriers (missing info, near-threshold income, residency mismatches, etc.)
- Supports targeted outreach to people at risk of churn
- Reveals common patterns across high-need populations
- Helps teams prioritize interventions based on evidence, not anecdotes

## Slide 8: Example Questions Leaders Can Answer

1. Which denial reasons are most common and most fixable through outreach or case support?
2. Which groups are most likely to lose coverage during life transitions (postpartum, aging out, earnings changes)?
3. Which pathways are frequently considered but not awarded, and what barriers are blocking access?
4. Where do similar households receive different outcomes, and what rule-level factors explain the difference?
5. What populations would likely gain, lose, or shift coverage if policy rules change?

## Slide 9: Key Takeaway

- `corticon.js` provides explainable decision logic
- The platform makes that logic evidence usable across people, time, and programs
- Together they support better individual outcomes and better system-wide decisions

## Optional Presenter Note (If Needed)

- This is not just automation of eligibility decisions; it is a transparent, queryable decision record that supports service delivery, oversight, and policy learning.
