# Phases 6–7: Feature Extraction and Anomaly Detection

This implementation adds an explainable, rules-based MVP. It is not a trained machine-learning model and must not be described as one.

## Phase 6 — Feature extraction

The `GET /api/attempts/:id/monitoring` response now includes a `features` object derived from saved monitoring events and answers, including tab/focus loss, paste/copy counts, answer changes, skipped questions, offline/online events, away durations, response-time summary, answered/unanswered counts, and event counts.

## Phase 7 — Explainable score

Monitoring event submissions update the attempt's 0–100 score using documented per-event weights and combined patterns. The response includes `anomalyScore`, `anomalyLevel`, contributing `factors`, the method identifier, and a caution that the score is not proof of misconduct. Thresholds come from the exam's configured low/medium/high values.

The `GET /api/attempts/:id/similarity` endpoint compares descriptive answers of at least 20 characters against submitted/expired attempts for the same exam. It reports token-overlap similarity and suggests review at 70% or higher. It does not expose other students' identities. This basic Jaccard-token method can miss paraphrases and can flag common wording; it is only a review signal.

## Run and verify locally

From the repository root in PowerShell:

```powershell
cd backend
npm install
npm run db:generate
npm run db:push
npm test
npm run build
npm run dev
```

With the backend running, check `http://localhost:4000/api/health` and `http://localhost:4000/api/db/health`. To verify monitoring and similarity endpoints, sign in, create and publish an exam, complete at least one attempt, and call the endpoints with that attempt ID. The current API does not yet enforce authentication on every attempt/monitoring route; use only local/demo data until the broader authorization work is completed.

## Responsible interpretation

A high score means the recorded activity deserves context-aware review. Tab switching, paste, network interruptions, similarity, and timing alone do not establish cheating. Faculty should review the timeline and answer context before making any decision.
