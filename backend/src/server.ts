import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { answerSimilarity, extractFeatures, scoreAnomaly } from './anomalyEngine.js';

const app = express();
const makeJoinCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();
const port = Number(process.env.PORT ?? 4000);
const prisma = new PrismaClient();
const sessionSecret = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === 'production' && (!sessionSecret || sessionSecret.length < 32)) {
  throw new Error('SESSION_SECRET must be set to a random value of at least 32 characters in production.');
}
const signingSecret = sessionSecret || crypto.randomBytes(32).toString('hex');

type AuthClaims = { userId: string; role: 'FACULTY' | 'STUDENT'; exp: number };
type AuthRequest = express.Request & { auth?: AuthClaims };
const issueSession = (user: { id: string; role: 'FACULTY' | 'STUDENT' }) => {
  const payload = Buffer.from(JSON.stringify({ userId: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 })).toString('base64url');
  const signature = crypto.createHmac('sha256', signingSecret).update(payload).digest('base64url');
  return payload + '.' + signature;
};
const readSession = (token: string): AuthClaims | null => {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  const expected = crypto.createHmac('sha256', signingSecret).update(payload).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AuthClaims;
    if (!claims.userId || !['FACULTY', 'STUDENT'].includes(claims.role) || !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000) return null;
    return claims;
  } catch { return null; }
};

app.use(cors({ origin: process.env.FRONTEND_ORIGIN ? process.env.FRONTEND_ORIGIN.split(',').map(value => value.trim()) : ['http://localhost:5173'] }));
app.use(express.json({ limit: '32kb' }));

// Public endpoints are deliberately limited to authentication and health checks.
app.use('/api', async (req, res, next) => {
  if (['/auth/signup', '/auth/signin', '/health', '/db/health'].includes(req.path) || req.path === '/') return next();
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const claims = readSession(token);
  if (!claims) return res.status(401).json({ message: 'Sign in required or session expired' });
  try {
    const user = await prisma.user.findUnique({ where: { id: claims.userId }, select: { id: true, role: true } });
    if (!user || user.role !== claims.role) return res.status(401).json({ message: 'Session is no longer valid' });
    (req as AuthRequest).auth = claims;
    return next();
  } catch (error) { return next(error); }
});
const authOf = (req: express.Request) => (req as AuthRequest).auth;
const requireRole = (req: express.Request, res: express.Response, role: 'FACULTY' | 'STUDENT') => {
  const auth = authOf(req);
  if (!auth) { res.status(401).json({ message: 'Sign in required' }); return false; }
  if (auth.role !== role) { res.status(403).json({ message: 'This action is not permitted for your role' }); return false; }
  return true;
};

type MonitoringEventInput = { type: string; metadata: string | null; createdAt: Date };
const parseEventMetadata = (metadata: string | null): Record<string, unknown> => {
  if (!metadata) return {};
  try {
    const value = JSON.parse(metadata);
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
  } catch { return {}; }
};

const buildMonitoringFeatures = (
  events: MonitoringEventInput[],
  questionCount = 0,
  answeredQuestionCount = 0
) => {
  const counts: Record<string, number> = {};
  const awayDurations: number[] = [];
  const firstResponseTimes: number[] = [];
  for (const event of events) {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
    const metadata = parseEventMetadata(event.metadata);
    const awayDuration = Number(metadata.awayDurationMs ?? 0);
    if (['TAB_VISIBLE', 'FOCUS_REGAINED', 'WINDOW_FOCUS'].includes(event.type) && Number.isFinite(awayDuration) && awayDuration > 0) awayDurations.push(awayDuration);
    if (event.type === 'ANSWER_CHANGED' && metadata.firstResponse === true) {
      const responseTime = Number(metadata.responseTimeMs);
      if (Number.isFinite(responseTime) && responseTime >= 0) firstResponseTimes.push(responseTime);
    }
  }
  const totalAwayMs = awayDurations.reduce((sum, value) => sum + value, 0);
  const maxAwayMs = awayDurations.length ? Math.max(...awayDurations) : 0;
  const averageResponseMs = firstResponseTimes.length
    ? firstResponseTimes.reduce((sum, value) => sum + value, 0) / firstResponseTimes.length
    : 0;
  const responseTimeDeviationMs = firstResponseTimes.length
    ? Math.sqrt(firstResponseTimes.reduce((sum, value) => sum + Math.pow(value - averageResponseMs, 2), 0) / firstResponseTimes.length)
    : 0;
  return {
    tabSwitchCount: counts.TAB_HIDDEN ?? 0,
    focusLossCount: (counts.FOCUS_LOST ?? 0) + (counts.WINDOW_BLUR ?? 0),
    totalAwayMs,
    maxAwayMs,
    pasteCount: counts.PASTE ?? 0,
    answerChangeCount: counts.ANSWER_CHANGED ?? 0,
    averageResponseMs: Math.round(averageResponseMs),
    responseTimeDeviationMs: Math.round(responseTimeDeviationMs),
    skippedQuestionCount: counts.SKIPPED_QUESTION ?? 0,
    answeredQuestionCount,
    unansweredQuestionCount: Math.max(0, questionCount - answeredQuestionCount),
    offlineCount: counts.OFFLINE ?? 0,
    onlineCount: counts.ONLINE ?? 0,
    tabVisibleCount: counts.TAB_VISIBLE ?? 0,
    focusRegainCount: (counts.FOCUS_REGAINED ?? 0) + (counts.WINDOW_FOCUS ?? 0),
    answerStartedCount: counts.ANSWER_STARTED ?? 0,
    answerSubmittedCount: counts.ANSWER_SUBMITTED ?? 0,
    eventCounts: counts
  };
};


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

const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many account creation attempts. Try again later.' } });
const signinLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many sign-in attempts. Try again later.' } });

app.post('/api/auth/signup', signupLimiter, async (req, res) => {
  try {
    const { name, email, password, role, rollNumber } = req.body;
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    if (!String(name ?? '').trim() || !normalizedEmail || !password || !['FACULTY', 'STUDENT'].includes(role)) {
      return res.status(400).json({ message: 'name, email, password and role are required' });
    }
    if (role === 'FACULTY' && (!process.env.FACULTY_SIGNUP_CODE || String(req.body.facultySignupCode ?? '') !== process.env.FACULTY_SIGNUP_CODE)) return res.status(403).json({ message: 'Faculty registration requires an administrator-issued invitation code' });
    if (String(password).length < 10) return res.status(400).json({ message: 'Password must be at least 10 characters' });
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
    return res.status(201).json({ user, token: issueSession(user) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not create account' });
  }
});

app.post('/api/auth/signin', signinLimiter, async (req, res) => {
  try {
    const { email, password, role, rollNumber } = req.body;
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const normalizedRoll = role === 'STUDENT' ? String(rollNumber ?? '').trim().toUpperCase() : null;
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || user.role !== role || (role === 'STUDENT' && user.rollNumber !== normalizedRoll) || !verifyPassword(String(password ?? ''), user.passwordHash)) {
      return res.status(401).json({ message: 'Invalid email, password, or role' });
    }
    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role, rollNumber: user.rollNumber };
    return res.json({ user: safeUser, token: issueSession(safeUser) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not sign in' });
  }
});

app.get('/api/health', (_req, res) => { res.json({ status: 'ok', service: 'anomalydash-api', version: '0.2.0', phase: 'database-integration', timestamp: new Date().toISOString() }); });

app.get('/api/db/health', async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; const [users, exams, questions] = await Promise.all([prisma.user.count(), prisma.exam.count(), prisma.question.count()]);
    res.json({ status: 'connected', database: 'postgresql', users, exams, questions });
  } catch (error) { console.error(error); res.status(503).json({ status: 'disconnected', database: 'sqlite' }); }
});

app.get('/api/faculty/:facultyId/history', async (req, res) => {
  if (!requireRole(req, res, 'FACULTY')) return;
  if (authOf(req)?.userId !== req.params.facultyId) return res.status(403).json({ message: 'You can only view your own history' });
  try {
    const exams = await prisma.exam.findMany({
      where: { facultyId: req.params.facultyId, status: 'COMPLETED' },
      include: {
        _count: { select: { questions: true } },
        attempts: { include: { student: { select: { id: true, name: true, email: true, rollNumber: true } } }, orderBy: { startedAt: 'desc' } }
      },
      orderBy: { updatedAt: 'desc' }
    });
    return res.json(exams);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not load faculty history' });
  }
});

app.get('/api/students/:studentId/history', async (req, res) => {
  if (!requireRole(req, res, 'STUDENT')) return;
  if (authOf(req)?.userId !== req.params.studentId) return res.status(403).json({ message: 'You can only view your own history' });
  try {
    const attempts = await prisma.examAttempt.findMany({
      where: { studentId: req.params.studentId, status: { in: ['SUBMITTED', 'EXPIRED'] } },
      include: { exam: { select: { id: true, title: true, subject: true, durationMin: true, status: true, faculty: { select: { name: true } } } } },
      orderBy: { submittedAt: 'desc' }
    });
    return res.json(attempts.map(({ anomalyScore: _score, anomalyLevel: _level, ...attempt }) => attempt));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not load student history' });
  }
});

app.get('/api/exams', async (req, res) => {
  const auth = authOf(req)!;
  const where = auth.role === 'FACULTY' ? { facultyId: auth.userId } : { status: 'LIVE' as const };
  const exams = await prisma.exam.findMany({ where, select: { id: true, title: true, subject: true, durationMin: true, lowThreshold: true, mediumThreshold: true, highThreshold: true, joinCode: auth.role === 'FACULTY', accessUrl: true, status: true, facultyId: true, createdAt: true, updatedAt: true, faculty: { select: { id: true, name: true } }, _count: { select: { questions: true } } }, orderBy: { createdAt: 'desc' } });
  res.json(exams);
});

app.post('/api/exams/:id/start', async (req, res) => {
  try {
    if (!requireRole(req, res, 'STUDENT')) return;
    const studentId = authOf(req)!.userId;
    const { joinCode } = req.body;
    if (!joinCode) return res.status(400).json({ message: 'joinCode is required' });
    const exam = await prisma.exam.findUnique({ where: { id: req.params.id }, include: { questions: { orderBy: { createdAt: 'asc' } } } });
    if (!exam || exam.joinCode !== String(joinCode).trim().toUpperCase()) return res.status(404).json({ message: 'Invalid test or code' });
    if (exam.status !== 'LIVE') return res.status(409).json({ message: 'This test is not live yet' });
    const student = await prisma.user.findUnique({ where: { id: String(studentId) } });
    if (!student || student.role !== 'STUDENT') return res.status(403).json({ message: 'Valid student account required' });
    const existing = await prisma.examAttempt.findUnique({ where: { examId_studentId: { examId: exam.id, studentId: student.id } }, include: { answers: true } });
    if (existing) {
      if (existing.status === 'IN_PROGRESS' && existing.expiresAt > new Date()) {
        const { anomalyScore: _score, anomalyLevel: _level, ...studentAttempt } = existing;
        return res.json({ attempt: studentAttempt, exam: { ...exam, questions: exam.questions.map(({ answerKey, ...q }) => q) } });
      }
      if (existing.status === 'IN_PROGRESS') {
        await prisma.examAttempt.update({ where: { id: existing.id }, data: { status: 'EXPIRED' } });
      }
      return res.status(409).json({ message: 'You have already used your attempt for this test' });
    }
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + exam.durationMin * 60 * 1000);
    const attempt = await prisma.examAttempt.create({ data: { examId: exam.id, studentId: student.id, startedAt, expiresAt } });
    const { anomalyScore: _score, anomalyLevel: _level, ...studentAttempt } = attempt;
    return res.status(201).json({ attempt: studentAttempt, exam: { ...exam, questions: exam.questions.map(({ answerKey, ...q }) => q) } });
  } catch (error) { console.error(error); return res.status(500).json({ message: 'Could not start exam' }); }
});

app.get('/api/attempts/:id', async (req, res) => {
  const attempt = await prisma.examAttempt.findUnique({ where: { id: req.params.id }, include: { exam: { include: { questions: { orderBy: { createdAt: 'asc' } } } }, answers: true } });
  if (!attempt) return res.status(404).json({ message: 'Exam attempt not found' });
  const auth = authOf(req)!;
  if (auth.role === 'STUDENT' && attempt.studentId !== auth.userId) return res.status(403).json({ message: 'You can only view your own attempt' });
  if (auth.role === 'FACULTY' && attempt.exam.facultyId !== auth.userId) return res.status(403).json({ message: 'You can only view attempts for your own exams' });
  const questions = attempt.exam.questions.map(({ answerKey, ...q }) => q);
  const { anomalyScore: _score, anomalyLevel: _level, ...studentAttempt } = attempt;
  return res.json({ attempt: studentAttempt, exam: { ...attempt.exam, questions } });
});

app.post('/api/attempts/:id/monitoring-events', async (req, res) => {
  if (!requireRole(req, res, 'STUDENT')) return;
  try {
    const { type, metadata } = req.body;
    const allowed = ['TAB_HIDDEN','TAB_VISIBLE','WINDOW_BLUR','WINDOW_FOCUS','PASTE','COPY','RAPID_ANSWERS','LONG_IDLE','FULLSCREEN_EXIT','OFFLINE','ONLINE','ANSWER_STARTED','ANSWER_CHANGED','ANSWER_SUBMITTED','SKIPPED_QUESTION'];
    if (!allowed.includes(String(type))) return res.status(400).json({ message: 'Invalid monitoring event' });
    const attempt = await prisma.examAttempt.findUnique({ where: { id: req.params.id }, include: { exam: { select: { lowThreshold: true, mediumThreshold: true, highThreshold: true } } } });
    if (!attempt) return res.status(404).json({ message: 'Exam attempt not found' });
    if (attempt.studentId !== authOf(req)!.userId) return res.status(403).json({ message: 'You can only submit monitoring events for your own attempt' });
    if (attempt.status !== 'IN_PROGRESS') return res.status(409).json({ message: 'This exam attempt is no longer active' });
    const event = await prisma.monitoringEvent.create({
      data: { attemptId: attempt.id, type: String(type), metadata: metadata ? JSON.stringify(metadata).slice(0, 500) : null }
    });
    const allEvents = await prisma.monitoringEvent.findMany({ where: { attemptId: attempt.id }, orderBy: { createdAt: 'asc' } });
    const detection = scoreAnomaly(allEvents, attempt.exam);
    const updatedAttempt = await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: { anomalyScore: detection.score, anomalyLevel: detection.anomalyLevel }
    });
    return res.status(201).json({
      event, anomalyScore: updatedAttempt.anomalyScore, anomalyLevel: updatedAttempt.anomalyLevel,
      factors: detection.factors, method: detection.method, note: detection.note
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not record monitoring event' });
  }
});

app.get('/api/attempts/:id/monitoring', async (req, res) => {
  if (!requireRole(req, res, 'FACULTY')) return;
  try {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: req.params.id },
      include: { monitoringEvents: { orderBy: { createdAt: 'asc' } }, answers: true, student: { select: { name: true, rollNumber: true } }, exam: { select: { title: true, questions: { select: { id: true } } } } }
    });
    if (!attempt) return res.status(404).json({ message: 'Exam attempt not found' });
    if (attempt.examId && (await prisma.exam.findUnique({ where: { id: attempt.examId }, select: { facultyId: true } }))?.facultyId !== authOf(req)!.userId) return res.status(403).json({ message: 'You can only inspect your own exams' });
    const features = extractFeatures(attempt.monitoringEvents, attempt.answers, attempt.exam.questions.length, attempt.startedAt);
    const detection = scoreAnomaly(attempt.monitoringEvents, await prisma.exam.findUniqueOrThrow({ where: { id: attempt.examId }, select: { lowThreshold: true, mediumThreshold: true, highThreshold: true } }));
    return res.json({ attemptId: attempt.id, student: attempt.student, exam: { title: attempt.exam.title }, events: attempt.monitoringEvents, features, anomaly: detection });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not load monitoring data' });
  }
});

app.put('/api/attempts/:id/answers', async (req, res) => {
  if (!requireRole(req, res, 'STUDENT')) return;
  try {
    const { questionId, answer } = req.body;
    const attempt = await prisma.examAttempt.findUnique({ where: { id: req.params.id } });
    if (!attempt) return res.status(404).json({ message: 'Exam attempt not found' });
    if (attempt.studentId !== authOf(req)!.userId) return res.status(403).json({ message: 'You can only edit your own attempt' });
    if (attempt.status !== 'IN_PROGRESS') return res.status(409).json({ message: 'This exam attempt is no longer active' });
    if (attempt.expiresAt <= new Date()) {
      await prisma.examAttempt.update({ where: { id: attempt.id }, data: { status: 'EXPIRED' } });
      return res.status(409).json({ message: 'Exam time has expired' });
    }
    const question = await prisma.question.findFirst({ where: { id: String(questionId), examId: attempt.examId } });
    if (!question) return res.status(404).json({ message: 'Question does not belong to this exam' });
    const saved = await prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId: question.id } },
      update: { answer: String(answer ?? '') },
      create: { attemptId: attempt.id, questionId: question.id, answer: String(answer ?? '') }
    });
    return res.json(saved);
  } catch (error) { console.error(error); return res.status(500).json({ message: 'Could not save answer' }); }
});

app.get('/api/attempts/:id/similarity', async (req, res) => {
  if (!requireRole(req, res, 'FACULTY')) return;
  try {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: req.params.id },
      include: { answers: true, exam: { include: { questions: { select: { id: true, type: true } } } } }
    });
    if (!attempt) return res.status(404).json({ message: 'Exam attempt not found' });
    if (attempt.exam.facultyId !== authOf(req)!.userId) return res.status(403).json({ message: 'You can only inspect attempts for your own exams' });

    const comparableAttempts = await prisma.examAttempt.findMany({
      where: {
        examId: attempt.examId,
        id: { not: attempt.id },
        status: { in: ['SUBMITTED', 'EXPIRED'] }
      },
      include: { answers: true }
    });
    const questionTypes = new Map(attempt.exam.questions.map(question => [question.id, question.type]));
    const results = attempt.answers
      .filter(answer => answer.answer.trim().length >= 20 && questionTypes.get(answer.questionId) === 'DESCRIPTIVE')
      .map(answer => {
        const comparisons = comparableAttempts
          .map(other => {
            const otherAnswer = other.answers.find(candidate => candidate.questionId === answer.questionId);
            return otherAnswer && otherAnswer.answer.trim().length >= 20
              ? { similarityPercent: answerSimilarity(answer.answer, otherAnswer.answer) }
              : null;
          })
          .filter((item): item is { similarityPercent: number } => item !== null);
        const maxSimilarityPercent = comparisons.reduce((max, item) => Math.max(max, item.similarityPercent), 0);
        return {
          questionId: answer.questionId,
          maxSimilarityPercent,
          comparedAnswerCount: comparisons.length,
          reviewSuggested: maxSimilarityPercent >= 70
        };
      });
    return res.json({
      attemptId: attempt.id,
      results,
      note: 'Token overlap is a basic screening signal, not proof of copied work. Short answers are excluded and faculty should review context.'
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not calculate answer similarity' });
  }
});

app.post('/api/attempts/:id/submit', async (req, res) => {
  if (!requireRole(req, res, 'STUDENT')) return;
  try {
    const attempt = await prisma.examAttempt.findUnique({ where: { id: req.params.id }, include: { answers: true, exam: { include: { questions: true } } } });
    if (!attempt) return res.status(404).json({ message: 'Exam attempt not found' });
    if (attempt.studentId !== authOf(req)!.userId) return res.status(403).json({ message: 'You can only submit your own attempt' });
    if (attempt.status !== 'IN_PROGRESS') return res.status(409).json({ message: 'This exam attempt is already closed' });
    const now = new Date();
    const expired = attempt.expiresAt <= now;
    const answerMap = new Map(attempt.answers.map(a => [a.questionId, a.answer.trim().toLowerCase()]));
    const score = attempt.exam.questions.reduce((total, q) => total + (q.type === 'MCQ' && q.answerKey && answerMap.get(q.id) === q.answerKey.trim().toLowerCase() ? q.marks : 0), 0);
    const updated = await prisma.examAttempt.update({ where: { id: attempt.id }, data: { status: expired ? 'EXPIRED' : 'SUBMITTED', submittedAt: now, score } });
    return res.json({ attempt: updated, score });
  } catch (error) { console.error(error); return res.status(500).json({ message: 'Could not submit exam' }); }
});

app.get('/api/exams/:id', async (req, res) => {
  const exam = await prisma.exam.findUnique({ where: { id: req.params.id }, include: { _count: { select: { questions: true } } } });
  if (!exam) return res.status(404).json({ message: 'Test not found' });
  const auth = authOf(req)!;
  if (auth.role === 'FACULTY' && exam.facultyId !== auth.userId) return res.status(403).json({ message: 'You can only view your own exams' });
  if (auth.role === 'STUDENT' && exam.status !== 'LIVE') return res.status(403).json({ message: 'This test is not available to students' });
  const { joinCode, ...publicExam } = exam;
  return res.json(auth.role === 'FACULTY' ? exam : publicExam);
});

app.post('/api/exams/:id/questions', async (req, res) => {
  if (!requireRole(req, res, 'FACULTY')) return;
  const { type, prompt, marks, options, answerKey } = req.body;
  if (!prompt || !marks || !['MCQ', 'DESCRIPTIVE'].includes(type)) return res.status(400).json({ message: 'type, prompt and marks are required' });
  const exam = await prisma.exam.findUnique({ where: { id: req.params.id } });
  if (!exam) return res.status(404).json({ message: 'Test not found' });
  if (exam.facultyId !== authOf(req)!.userId) return res.status(403).json({ message: 'Only the test owner can add questions' });
  if (exam.status !== 'DRAFT') return res.status(409).json({ message: 'Questions are locked after the test is published' });
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

app.patch('/api/exams/:id/end', async (req, res) => {
  if (!requireRole(req, res, 'FACULTY')) return;
  try {
    const exam = await prisma.exam.findUnique({ where: { id: req.params.id } });
    if (!exam) return res.status(404).json({ message: 'Test not found' });
    if (exam.facultyId !== authOf(req)!.userId) return res.status(403).json({ message: 'Only the test owner can end this session' });
    if (exam.status !== 'LIVE') return res.status(409).json({ message: 'This test is not currently live' });

    const now = new Date();
    await prisma.examAttempt.updateMany({
      where: { examId: exam.id, status: 'IN_PROGRESS' },
      data: { status: 'SUBMITTED', submittedAt: now }
    });
    const updated = await prisma.exam.update({ where: { id: exam.id }, data: { status: 'COMPLETED' } });
    return res.json(updated);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not end live session' });
  }
});

app.get('/api/exams/:id/monitoring', async (req, res) => {
  if (!requireRole(req, res, 'FACULTY')) return;
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: req.params.id },
      include: {
        attempts: {
          include: { student: { select: { name: true, rollNumber: true } }, monitoringEvents: { orderBy: { createdAt: 'desc' } }, answers: true, exam: { select: { questions: { select: { id: true } } } } },
          orderBy: { startedAt: 'desc' }
        }
      }
    });
    if (!exam) return res.status(404).json({ message: 'Test not found' });
    if (exam.facultyId !== authOf(req)!.userId) return res.status(403).json({ message: 'Only the exam owner can view live monitoring' });
    return res.json(exam.attempts.map(attempt => ({
      id: attempt.id, student: attempt.student, status: attempt.status,
      anomalyScore: attempt.anomalyScore, anomalyLevel: attempt.anomalyLevel,
      startedAt: attempt.startedAt, events: attempt.monitoringEvents.slice(0, 8),
      features: extractFeatures(attempt.monitoringEvents, attempt.answers, attempt.exam.questions.length, attempt.startedAt)
    })).sort((a, b) => b.anomalyScore - a.anomalyScore || b.startedAt.getTime() - a.startedAt.getTime()));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Could not load live monitoring data' });
  }
});

app.patch('/api/exams/:id/publish', async (req, res) => {
  if (!requireRole(req, res, 'FACULTY')) return;
  const exam = await prisma.exam.findUnique({ where: { id: req.params.id }, include: { _count: { select: { questions: true } } } });
  if (!exam) return res.status(404).json({ message: 'Test not found' });
  if (exam.facultyId !== authOf(req)!.userId) return res.status(403).json({ message: 'Only the test owner can publish this test' });
  if (exam.status !== 'DRAFT') return res.status(409).json({ message: 'Only draft tests can be published' });
  if (exam._count.questions === 0) return res.status(400).json({ message: 'Add at least one question before publishing' });
  const updated = await prisma.exam.update({ where: { id: exam.id }, data: { status: 'LIVE' } });
  return res.json(updated);
});

app.delete('/api/exams/:id', async (req, res) => {
  if (!requireRole(req, res, 'FACULTY')) return;
  try {
    const exam = await prisma.exam.findUnique({ where: { id: req.params.id } });
    if (!exam) return res.status(404).json({ message: 'Test not found' });
    if (exam.facultyId !== authOf(req)!.userId) return res.status(403).json({ message: 'Only the test owner can remove this test' });
    if (exam.status !== 'COMPLETED') return res.status(409).json({ message: 'Only completed tests can be removed' });
    await prisma.exam.delete({ where: { id: exam.id } });
    return res.json({ message: 'Completed test removed' });
  } catch (error) { console.error(error); return res.status(500).json({ message: 'Could not remove test' }); }
});

app.post('/api/exams/join', async (req, res) => {
  if (!requireRole(req, res, 'STUDENT')) return;
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
  if (!requireRole(req, res, 'FACULTY')) return;
  const { title, subject, durationMin } = req.body;
  const facultyId = authOf(req)!.userId;
  const lowThreshold = Number(req.body.lowThreshold ?? 30);
  const mediumThreshold = Number(req.body.mediumThreshold ?? 60);
  const highThreshold = Number(req.body.highThreshold ?? 80);
  if (!title || !subject || !Number.isInteger(Number(durationMin)) || Number(durationMin) < 1 || Number(durationMin) > 300) return res.status(400).json({ message: 'A title, subject and duration from 1 to 300 minutes are required' });
  if (![lowThreshold, mediumThreshold, highThreshold].every(value => Number.isInteger(value) && value >= 1 && value <= 100) || !(lowThreshold < mediumThreshold && mediumThreshold < highThreshold)) {
    return res.status(400).json({ message: 'Thresholds must be whole numbers from 1 to 100 in ascending order: low < medium < high' });
  }
  const faculty = await prisma.user.findUnique({ where: { id: facultyId } });
  if (!faculty) return res.status(400).json({ message: 'No faculty user exists. Run npm run db:seed first.' });
  const joinCode = makeJoinCode();
  const exam = await prisma.exam.create({ data: { title: String(title).trim(), subject: String(subject).trim(), durationMin: Number(durationMin), lowThreshold, mediumThreshold, highThreshold, facultyId: faculty.id, joinCode } });
  const host = req.get('host') ?? 'localhost:4000';
  const accessUrl = `${req.protocol}://${host.replace(':4000', ':5173')}/#/test/${exam.id}`;
  const updated = await prisma.exam.update({ where: { id: exam.id }, data: { accessUrl } });
  return res.status(201).json(updated);
});

app.get('/api', (_req, res) => { res.json({ name: 'AnomalyDash API', message: 'Database-backed API is running.' }); });
app.listen(port, () => { console.log('AnomalyDash API listening on http://localhost:' + port); });
process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });