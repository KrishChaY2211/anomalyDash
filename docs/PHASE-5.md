# AnomalyDash — Phase 5: Explainable Anomaly Monitoring

**Implementation status:** Core monitoring enhancements committed; local build and end-to-end verification still required.

## Objective

Provide faculty with a continuously refreshed, evidence-led view of student examination behaviour. Scores are decision-support signals only; they are not proof of misconduct and must not trigger automatic punishment or exam termination.

## Delivered in Phase 5

- Faculty live-monitoring screen refreshes automatically every 1.5 seconds.
- Monitoring records tab visibility, window focus/blur, paste, copy, rapid-answer, long-idle and fullscreen-exit signals.
- Anomaly scores are bounded from 0 to 100 and persisted on the exam attempt.
- Combined signal bonuses are applied for focus loss with paste, focus loss with long idle, and repeated interruptions.
- Each exam stores faculty-configurable Low, Medium and High score thresholds. Defaults are 30, 60 and 80, respectively; values must be whole numbers from 1–100 in ascending order.
- Monitoring API returns the updated score, level and contributing event factors to the student-side event handler.
- Faculty monitoring sorts students by score and displays recent events.
- Faculty can expand a student's row to inspect a timestamped evidence timeline and event metadata.
- The interface explicitly explains that behaviour signals are for faculty review, not proof of misconduct.
- Monitoring APIs continue to avoid collecting clipboard contents.

## Local verification

From the repository root, pull the latest commits, then run these in separate PowerShell terminals.

Backend:
```powershell
cd backend
npm.cmd run build
npm.cmd run dev
```

Frontend:
```powershell
cd frontend
npm.cmd run build
npm.cmd run dev
```

The backend's development command runs Prisma generation and schema synchronization. Open `http://localhost:5173`, create/sign in as faculty, create a new exam, and set ascending thresholds. Add a question, publish the exam, then join as a student in a second browser/session. Generate a few test signals during the attempt and confirm the faculty Live Monitoring screen refreshes, sorts by score, and exposes the evidence timeline. Also verify that normal answering remains usable and the exam is not automatically terminated by an anomaly score.

## Remaining verification / limitations

- Builds and browser end-to-end flow must be run locally; GitHub commits alone do not prove runtime success.
- Current scoring is an explainable, deterministic weighted-rule MVP with combined-signal bonuses. It is **not** a trained ML model or a validated statistical outlier model.
- Descriptive-answer similarity, student-to-student similarity, and a dedicated persistent incident/review-action workflow are not implemented by this change.
- Browser focus/visibility signals are inherently imperfect and can have benign causes. Faculty must review the evidence before making decisions.
