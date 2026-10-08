# AnomalyDash — Phase 1: Foundation

**Status:** Complete  
**Version:** 0.1.0  
**Team:** CodeMatriX

## Objective

Establish a clean, runnable full-stack foundation for AnomalyDash and provide a professional product shell that can be shown to hackathon evaluators.

## Delivered

### Frontend

- React + TypeScript + Vite application
- Branded AnomalyDash interface
- Responsive professional visual system
- Faculty/student entry preview
- Live-exam dashboard preview
- Core product pipeline presentation
- Engineering-principles section
- Mobile-friendly layout

### Backend

- Node.js + Express + TypeScript API
- CORS and JSON middleware
- Environment configuration
- Health endpoint: `GET /api/health`
- Base API endpoint: `GET /api`

## Architecture Baseline

```
Browser
   |
   v
React + TypeScript + Vite
   |
   | HTTP / future real-time transport
   v
Express + TypeScript API
   |
   v
Application Services
   |
   +--> Examination
   +--> Behaviour Events
   +--> Answer Analysis
   +--> Anomaly Engine
   +--> Faculty Monitoring
```

Database, authentication, real-time transport, and anomaly services will be introduced in subsequent implementation work.

## Local Development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm run dev
```

Frontend: `http://localhost:5173`  
API: `http://localhost:4000`  
Health check: `http://localhost:4000/api/health`

## Phase 1 Definition of Done

- [x] Repository foundation established
- [x] Frontend scaffold created
- [x] Backend scaffold created
- [x] Frontend and backend have independent run/build scripts
- [x] Professional branded interface created
- [x] Backend health endpoint created
- [x] Documentation added
- [x] No webcam, microphone, or invasive monitoring added
- [x] No unfinished feature is presented as functional

## Next

The next implementation work will build the first real application workflow on top of this foundation, while preserving the existing visual language and architecture.
