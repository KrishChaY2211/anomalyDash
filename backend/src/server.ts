import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const app = express();
const makeJoinCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();
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
    const { name, email, password, role, rollNumber } = req.body;
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    if (!String(name ?? '').trim() || !normalizedEmail || !password || !['FACULTY', 'STUDENT'].includes(role)) {
      return res.status(400).json({ message: 'name, email, password and role are required' });
    }
    if (String(password).length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const normalizedRoll = role === 'STUDENT' ? String(rollNumber ?? '').trim().toUpperCase() : null;
    if (role === 'STUDENT' && !normalizedRoll) return res.status(400).json({ message: 'Roll number is required for students' });
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ message: 'An account with this email already exists' });
    if (normalizedRoll) {
      const existingRoll = await prisma.user.findUnique({ where: { rollNumber: normalizedRoll } });
      if (existingRoll) return res.status(409).json({ message: 'An account with this roll number already exists' });
    }
    const user = await prisma.user.create({
      data: { name: String(name).trim(), email: normalizedEmail, passwordHash: hashPassword(String(password)), role, rollNumber: normalizedRoll },
      select: { id: true, name: true, email: true, role: true, rollNumber: true }
    });
    return res.status(201).json({ user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not create account' });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password, role, rollNumber } = req.body;
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const normalizedRoll = role === 'STUDENT' ? String(rollNumber ?? '').trim().toUpperCase() : null;
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || user.role !== role || (role === 'STUDENT' && user.rollNumber !== normalizedRoll) || !verifyPassword(String(password ?? ''), user.passwordHash)) {
      return res.status(401).json({ message: 'Invalid email, password, or role' });
    }
    return res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, rollNumber: user.rollNumber } });
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

app.get('/api/exams', async (req, res) => {
  const facultyId = typeof req.query.facultyId === 'string' ? req.query.facultyId : undefined;
  const exams = await prisma.exam.findMany({ where: facultyId ? { facultyId } : undefined({ include: { faculty: true, _count: { select: { questions: true } } }, orderBy: { createdAt: 'desc' } });
  res.json(exams);
});

app.get('/api/exams/:id', async (req, res) => {
  const exam = await prisma.exam.findUnique({ where: { id: req.params.id }, include: { _count: { select: { questions: true } } } });
  if (!exam) return res.status(404).json({ message: 'Test not found' });
  return res.json(exam);
});

app.post('/api/exams/:id/questions', async (req, res) => {
  const { type, prompt, marks, options, answerKey } = req.body;
  if (!prompt || !marks || !['MCQ', 'DESCRIPTIVE'].includes(type)) return res.status(400).json({ message: 'type, prompt and marks are required' });
  const exam = await prisma.exam.findUnique({ where: { id: req.params.id } });
  if (!exam) return res.status(404).json({ message: 'Test not found' });
  const question = await prisma.question.create({
    data: {
      examId: exam.id,
      type,
      prompt: String(prompt).trim(),
      marks: Number(marks),
      options: options ? String(options).trim() : null,
      answerKey: answerKey ? String(answerKey).trim() : null
    }
  });
  return res.status(201).json(question);
});

app.patch('/api/exams/:id/publish', async (req, res) => {
  const exam = await prisma.exam.findUnique({ where: { id: req.params.id }, include: { _count: { select: { questions: true } } } });
  if (!exam) return res.status(404).json({ message: 'Test not found' });
  if (exam._count.questions === 0) return res.status(400).json({ message: 'Add at least one question before publishing' });
  const updated = await prisma.exam.update({ where: { id: exam.id }, data: { status: 'LIVE' } });
  return res.json(updated);
});

app.post('/api/exams/join', async (req, res) => {
  const { testUrl, joinCode } = req.body;
  const normalizedCode = String(joinCode ?? '').trim().toUpperCase();
  if (!testUrl || !normalizedCode) return res.status(400).json({ message: 'Test URL and test code are required' });
  const examId = String(testUrl).split('/').filter(Boolean).pop();
  const exam = await prisma.exam.findFirst({ where: { id: examId, joinCode: normalizedCode }, select: { id: true, title: true, subject: true, durationMin: true, status: true, joinCode: true } });
  if (!exam) return res.status(404).json({ message: 'Invalid test URL or code' });
  if (exam.status !== 'LIVE') return res.status(409).json({ message: 'This test is not live yet' });
  return res.json({ exam });
});

app.post('/api/exams', async (req, res) => {
  const { title, subject, durationMin, facultyId } = req.body;
  if (!title || !subject || !durationMin) return res.status(400).json({ message: 'title, subject and durationMin are required' });
  const faculty = facultyId ? await prisma.user.findUnique({ where: { id: facultyId } }) : await prisma.user.findFirst({ where: { role: 'FACULTY' } });
  if (!faculty) return res.status(400).json({ message: 'No faculty user exists. Run npm run db:seed first.' });
  const joinCode = makeJoinCode();
  const exam = await prisma.exam.create({ data: { title: String(title).trim(), subject: String(subject).trim(), durationMin: Number(durationMin), facultyId: faculty.id, joinCode } });
  const accessUrl = `${req.protocol}://${req.get('host').replace(':4000', ':5173')}/#/test/${exam.id}`;
  const updated = await prisma.exam.update({ where: { id: exam.id }, data: { accessUrl } });
  return res.status(201).json(updated);
});

app.get('/api', (_req, res) => { res.json({ name: 'AnomalyDash API', message: 'Database-backed API is running.' }); });
app.listen(port, () => { console.log('AnomalyDash API listening on http://localhost:' + port); });
process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });