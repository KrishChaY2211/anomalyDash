# AnomalyDash — Phase Audit (2026-10-09)

## Why this audit exists

A successful Render deployment proves that a deployment reached the live state. It does not prove that every user workflow works end-to-end. Phase completion requires builds, API authorization checks, database persistence checks, and a browser-level acceptance pass.

## Repository and deployment snapshot

- Repository: `KrishChaY2211/anomalyDash`
- Branch used by the configured Render services: `security/deployment-readiness`
- Frontend: `anomalydash-web`
- Primary API: `anomalydash-api`
- A second API service named `anomalydash-demo-api` also exists. Confirm which one the frontend is configured to use before changing service settings.
- The frontend and primary API have live Render deploy records for commit `cd9cb2a` (Add faculty Question Bank creation flow).
- Render auto-deploy is disabled on these services; a GitHub push alone should not be assumed to update production.

## Phase status

| Phase | Audit status | Evidence / remaining checks |
|---|---|---|
| 1 — Foundation | Implemented; build not re-run in this audit | React/Vite frontend, Express API, health endpoints and Phase 1 docs exist. |
| 2 — Database integration | Implemented; production persistence must be verified | Prisma models and health endpoint exist. Confirm the production API reports a connected PostgreSQL database and that create/read data survives refresh and redeploy. |
| 3 — Authentication and exam setup | Implemented in code; acceptance test pending | Signup/signin, signed session tokens, role checks, exam creation and question endpoints exist in the API. Test faculty/student role isolation and persistence. |
| 4 — Student attempt workflow | Implemented in code; acceptance test pending | Join-code validation, attempt creation, answer saving, timer expiry and submission paths exist. Test the full faculty-to-student flow. |
| 5 — Behavioural anomaly monitoring | Partially verified; not safe to call complete yet | Event collection, deterministic weighted scoring, thresholds, feature summaries and faculty monitoring endpoints exist. Run frontend/backend builds and an end-to-end browser test. Scores are signals for faculty review, not proof of misconduct. |
| 6 — Faculty Question Bank | Implemented in code; acceptance test pending | Faculty-owned question-bank list/create and add-to-draft-exam endpoints exist. Test ownership isolation, validation, persistence and adding a saved question to a draft exam. |
| 7 — Security and deployment readiness | Partially implemented; not signed off | Password hashing, signed sessions, role/ownership checks, rate limits, production session-secret validation and a PostgreSQL schema exist. Run authorization tests and verify production environment configuration and database connectivity. |
| Next — Review workflow and final acceptance | Not complete | Add a durable faculty review decision/action trail for anomaly evidence, expose answer-similarity results in the faculty interface, then run full acceptance tests. |

## Important technical caveats

- The anomaly scorer is currently `explainable-rules-v1`, a deterministic weighted-rule system. It is not a trained machine-learning model.
- The API has an answer-similarity endpoint that uses token-overlap/Jaccard-style comparison for sufficiently long descriptive answers against other completed/expired attempts. This is a basic screening signal and can miss paraphrases or flag legitimate shared terminology. It is not proof of copying.
- The existence of an API endpoint does not mean the faculty interface exposes it or that it has been tested.
- Monitoring-event retry buffering is in memory only and does not survive a page reload.
- Browser focus/visibility signals can have benign causes. Faculty should review context; no score should automatically punish or terminate a student.
- The repository currently has a Phase 5 document that explicitly requires build and end-to-end verification. No such test run was performed by this audit.

## Required acceptance pass before claiming the MVP is complete

1. Run `npm run build` in `backend` and `frontend`.
2. Run `npm test` in `backend` and fix all failures.
3. Verify `/api/health` and `/api/db/health` on the primary Render API.
4. Sign up/sign in as faculty; create an exam; add questions; save a question to the Question Bank; reuse it in a draft exam; publish.
5. Sign in as a student; join using the URL/code; answer questions; refresh; confirm saved answers persist; submit.
6. Generate test monitoring events and confirm the faculty view shows score, factors, event timeline and student ordering.
7. Verify the similarity endpoint is visible/useful in the faculty workflow, and test with synthetic answers that are similar and dissimilar.
8. Test that students cannot access faculty endpoints, one faculty member cannot inspect another faculty member's exams/question bank, and expired/closed attempts cannot be changed.
9. Verify database persistence after an API restart/redeploy.
10. Record the test outcomes and only then mark each phase complete.

## Recommended next implementation phase

**Phase 8 — Faculty Review and Evidence Workflow**

- Give each flagged attempt an explicit review state such as `UNREVIEWED`, `REVIEWED`, or `DISMISSED`.
- Persist who made the decision, when it was made, and an optional faculty note.
- Enforce exam ownership and faculty role checks on every review endpoint.
- Show the review state and saved note in the faculty monitoring/evidence view.
- Surface descriptive-answer similarity comparisons as review evidence, with a clear explanation that similarity is not proof of misconduct.
- Add tests for authorization, state transitions, persistence and edge cases.

This phase should be implemented and tested on a working branch before the production services are updated.
