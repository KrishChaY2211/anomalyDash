# Phase 2 — Database Integration

**Status:** Complete  
**Version:** 0.2.0  
**Team:** CodeMatriX

## Objective
Connect AnomalyDash to persistent application data so the evaluator can see a real full-stack flow instead of static demo values.

## Delivered
- SQLite database for zero-configuration local development.
- Prisma ORM with typed models.
- User, Exam and Question entities.
- Seeded faculty and sample exam data.
- Database health endpoint with record counts.
- Exam listing and creation APIs backed by SQLite.
- Frontend API proxy for local development.

## Data model
```
User (Faculty)
   |
   +----< Exam
             |
             +----< Question
```

Behaviour events, answer submissions, anomaly incidents and student/exam participation will be added in later phases.

## Local setup
```bash
cd backend
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Database health: http://localhost:4000/api/db/health

Frontend:
```bash
cd frontend
npm install
npm run dev
```

The frontend proxies /api requests to the backend.

## Evaluator story
A faculty member can create an exam through the API, the record is persisted through Prisma, and the faculty UI reads persisted exam records back from the database. This establishes the first real application-data loop.

## Scope boundary
Authentication, student enrollment, answer persistence, behaviour events and anomaly incidents build on this database foundation in subsequent phases.
