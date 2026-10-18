# AnomalyDash — Vercel + PostgreSQL Deployment

AnomalyDash is now structured for a serverless deployment:

```text
React + Vite frontend
        ↓
      Vercel
        ↓
Vercel Function (Express API)
        ↓
PostgreSQL
```

## 1. Create PostgreSQL

Create a PostgreSQL database in Supabase (or another PostgreSQL provider).

For serverless traffic, use the provider's pooled/transaction connection string when recommended by the provider. With Supabase, the transaction pooler uses port `6543`.

Set:

```env
DATABASE_URL="postgresql://..."
```

## 2. Create the database schema

The Prisma datasource is now PostgreSQL.

From the repository root:

```bash
npm install
npm run db:generate
npm run db:push
```

Optional demo data:

```bash
cd backend
npm install
npm run db:seed
```

Do not commit the production database URL.

## 3. Deploy the repository to Vercel

Import the GitHub repository and keep the **repository root** as the Vercel project root.

The repository already contains `vercel.json` with:

- Vite build output at `frontend/dist`
- a Vercel catch-all API function at `api/[...path].ts`
- a 60-second function duration

The root build command is:

```bash
npm run build
```

That command generates Prisma Client and builds the frontend.

## 4. Add Vercel environment variables

Add these in Vercel Project Settings → Environment Variables:

```env
DATABASE_URL=<your PostgreSQL pooled connection string>
PUBLIC_APP_URL=https://<your-vercel-domain>
```

`PUBLIC_APP_URL` is optional. If omitted, AnomalyDash derives the public URL from the incoming Vercel request.

Set the database variable for Preview and Production environments as appropriate.

## 5. Verify deployment

After deployment, verify:

```text
/api
/api/health
/api/db/health
```

The database health endpoint should report `postgresql` and the expected record counts.

Then verify the full flow:

1. Faculty signup/sign-in
2. Create an exam
3. Add questions
4. Publish the exam
5. Student joins with the generated code
6. Student answers questions
7. Monitoring events appear
8. Faculty monitoring displays anomaly evidence
9. Exam submission completes normally

## 6. Render is no longer required by the repository

There is no `render.yaml` deployment configuration in the repository. The application deployment target is now Vercel.

The existing Render service, if one still exists in your Render account, is independent of this repository configuration. Disable or delete that service from the Render dashboard **only after the Vercel deployment has been verified**.

## Data migration note

Changing Prisma from SQLite to PostgreSQL creates a new PostgreSQL database schema. Existing SQLite records are not automatically copied into PostgreSQL.

If the current Render/local SQLite database contains data that must be preserved, perform a separate data export/import before deleting the old deployment.
