# Phase 2 — Database Integration

**Status:** Complete  
**Version:** 0.2.0  
**Team:** CodeMatriX

## Objective
Connect AnomalyDash to persistent application data and provide a working faculty/student application shell so the evaluator can see a real full-stack flow instead of static demo values.

## Delivered
- SQLite database for zero-configuration local development.
- Prisma ORM with typed models.
- User, Exam and Question entities.
- Seeded faculty and sample exam data.
- Database health endpoint with record counts.
- Exam listing and creation APIs backed by SQLite.
- Frontend API proxy for local development.
- Working Overview, Faculty and Student navigation using hash routes.
- Faculty workspace with a real exam creation form.
- Student workspace that reads persisted exams from the database.
- Responsive UI for the Phase 2 application shell.

## Data model

    User (Faculty)
       |
       +----< Exam
                 |
                 +----< Question

Behaviour events, answer submissions, anomaly incidents and student/exam participation will be added in later phases.

## Local setup
    cd backend
    npm install
    npm run db:generate
    npm run db:push
    npm run db:seed
    npm run dev

Frontend:
    cd frontend
    npm install
    npm run dev

The frontend proxies /api requests to the backend.

## Phase 2 acceptance checks
1. Open the frontend and confirm the database status becomes **connected**.
2. Click **Continue as Faculty** and confirm the Faculty workspace opens.
3. Create an exam and confirm it appears in the persisted exam list.
4. Click **Student** and confirm the same exam appears in the Student workspace.
5. Refresh the browser and confirm the exam remains because it is stored in SQLite.
6. Use the top navigation to return to Overview.

## Evaluator story
A faculty member can create an exam through the UI, the record is persisted through Prisma, and both faculty and student views read persisted exam records back from the database. This establishes the first real application-data loop.

## Scope boundary
Authentication, student enrollment, answer persistence, behaviour events and anomaly incidents build on this database foundation in subsequent phases.
