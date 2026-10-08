import 'dotenv/config';
import cors from 'cors';
import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'anomalydash-api',
    version: '0.1.0',
    phase: 'foundation',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api', (_req, res) => {
  res.json({
    name: 'AnomalyDash API',
    message: 'Foundation API is running.',
  });
});

app.listen(port, () => {
  console.log(`AnomalyDash API listening on http://localhost:${port}`);
});