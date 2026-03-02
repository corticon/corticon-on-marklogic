# Corticon.js Decision Transparency and Platform Value

## 1) Role of the `corticon.js` decision service and the data it exposes

The `corticon.js` decision service is the policy decision engine. It applies Medicaid eligibility logic consistently to each case (household and person), evaluates applicable pathways, and produces both the determination and the evidence behind that determination.

What it exposes from each decision (at a granular level) includes:

- Final outcomes (eligible/ineligible, pathway selected, coverage result)
- Pathways considered, including pathways that were evaluated but not selected
- Rule trace details (which rules/conditions were met, not met, or skipped)
- Key derived values used in the decision (for example, countable income/resources, FPL comparisons, age/category checks, residency/citizenship factors, pregnancy/postpartum status, disability-related indicators)
- Reasons/explanations tied to specific facts and thresholds, not just a generic denial/approval
- Versioned decision context (which logic bundle/rule set produced the result)

Why this matters versus a less transparent automation approach:

- A typical opaque rules implementation often returns only the final answer and maybe a short reason code.
- It is very difficult (and sometimes impossible) to reconstruct exactly why a pathway failed, what threshold was crossed, or which competing pathway was considered.
- It is also difficult to audit past determinations after logic changes if the underlying rule-level evidence was not captured at decision time.

In short, `corticon.js` is not just automating decisions; it is exposing the decision path.

## 2) How the platform enables access, context, and population-level understanding

The platform makes the `corticon.js` outputs usable at scale by organizing and connecting the rich decision data, not just storing final determinations.

The platform facilitates this by:

- Persisting granular decision artifacts (case facts, pathway evaluations, rule traces, explanations, outcomes)
- Tying decision evidence to business context (household, person, time period, state/program context, prior pathway/history where available)
- Making the data queryable across many dimensions at once (demographics, pathway, denial reason, threshold bands, geography, time, policy version)
- Preserving historical decision records so teams can compare past, present, and future logic behavior
- Supporting population-level analysis without losing the ability to drill down to an individual determination

This is what enables teams to move from:

- "What happened in this one case?"

to:

- "What patterns are we seeing across thousands of determinations, and what barriers are repeatedly preventing coverage access?"

A less connected environment may still store outputs, but it usually cannot reliably answer those questions because the rule-level evidence is not normalized, linked, and queryable in a consistent way.

## 3) Non-technical, service-focused questions this platform can answer

From the standpoint of someone focused on improving services and coverage access (not writing code), the platform enables questions like:

1. Which people are being denied or delayed for reasons that are potentially addressable (for example: missing information, residency mismatch, income just over a threshold), and what service interventions would help most?
2. Which populations are most likely to churn on and off coverage (for example after earnings changes, postpartum transitions, or age-related pathway changes), and where should outreach be targeted before coverage is lost?
3. What are the most common pathways considered but not awarded, and what recurring barriers are preventing otherwise high-need individuals from qualifying through those pathways?
4. Are there groups with similar clinical or household circumstances who are ending up with different outcomes, and what rule-level factors explain the difference?
5. If a policy threshold or eligibility rule changes in the future, which current and historically similar populations would likely gain coverage, lose coverage, or shift pathways?

These questions require both transparency (what the decision logic actually did) and organization (a platform that links those details across cases and time).
