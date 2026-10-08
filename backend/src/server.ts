import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());


const hashPassword = (password: string) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password: string, stored: string) => {
  const [salt, storedHash] = stored.split(':');
  if (!salt || !storedHash) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
};

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    if (!String(name ?? '').trim() || !normalizedEmail || !password || !['FACULTY', 'STUDENT'].includes(role)) {
      return res.status(400).json({ message: 'name, email, password and role are required' });
    }
    if (String(password).length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ message: 'An account with this email already exists' });
    const user = await prisma.user.create({
      data: { name: String(name).trim(), email: normalizedEmail, passwordHash: hashPassword(String(password)), role },
      select: { id: true, name: true, email: true, role: true }
    });
    return res.status(201).json({ user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not create account' });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || user.role !== role || !verifyPassword(String(password ?? ''), user.passwordHash)) {
      return res.status(401).json({ message: 'Invalid email, password, or role' });
    }
    return res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not sign in' });
  }
});

app.get('/api/health', (_req, res) => { res.json({ status: 'ok', service: 'anomalydash-api', version: '0.2.0', phase: 'database-integration', timestamp: new Date().toISOString() }); });

app.get('/api/db/health', async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; const [users, exams, questions] = await Promise.all([prisma.user.count(), prisma.exam.count(), prisma.question.count()]);
    res.json({ status: 'connected', database: 'sqlite', users, exams, questions });
  } catch (error) { console.error(error); res.status(503).json({ status: 'disconnected', database: 'sqlite' }); }
});

app.get('/api/exams', async (_req, res) => {
  const exams = await prisma.exam.findMany({ include: { faculty: true, _count: { select: { questions: true } } }, orderBy: { createdAt: 'desc' } });
  res.json(exams);
});

app.post('/api/exams', async (req, res) => {
  const { title, subject, durationMin, facultyId } = req.body;
  if (!title || !subject || !durationMin) return res.status(400).json({ message: 'title, subject and durationMin are required' });
  const faculty = facultyId ? await prisma.user.findUnique({ where: { id: facultyId } }) : await prisma.user.findFirst({ where: { role: 'FACULTY' } });
  if (!faculty) return res.status(400).json({ message: 'No faculty user exists. Run npm run db:seed first.' });
  const exam = await prisma.exam.create({ data: { title, subject, durationMin: Number(durationMin), facultyId: faculty.id } });
  return res.status(201).json(exam);
});

app.get('/api', (_req, res) => { res.json({ name: 'AnomalyDash API', message: 'Database-backed API is running.' }); });
app.listen(port, () => { console.log('AnomalyDash API listening on http://localhost:' + port); });
process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });