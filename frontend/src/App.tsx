import { Fragment, useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';

async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = localStorage.getItem('anomalydash_token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return window.fetch(input, { ...init, headers });
}


type View = 'home' | 'login' | 'faculty' | 'student' | 'exam' | 'faculty-history' | 'student-history' | 'faculty-monitoring';
type Role = 'faculty' | 'student';
type AuthMode = 'signin' | 'signup';

type User = { id: string; name: string; email: string; role: 'FACULTY' | 'STUDENT'; rollNumber?: string | null };
type Exam = {
  id: string;
  title: string;
  subject: string;
  durationMin: number;
  lowThreshold?: number;
  mediumThreshold?: number;
  highThreshold?: number;
  status: string;
  joinCode?: string | null;
  accessUrl?: string | null;
  _count?: { questions: number };
};
type Question = { id: string; type: string; prompt: string; marks: number; options?: string | null; answerKey?: string | null };

function getInitialView(): View {
  const hash = window.location.hash.replace('#/', '');
  if (hash === 'faculty') return 'faculty';
  if (hash === 'student') return 'student';
  if (hash === 'login') return 'login';
  if (hash === 'exam' || hash.startsWith('exam/')) return 'exam';
  if (hash === 'faculty-history') return 'faculty-history';
  if (hash === 'faculty-monitoring') return 'faculty-monitoring';
  if (hash === 'student-history') return 'student-history';
  return 'home';
}

function App() {
  const [view, setView] = useState<View>(getInitialView);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [role, setRole] = useState<Role>('student');
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [dbStatus, setDbStatus] = useState('checking');
  const [exams, setExams] = useState<Exam[]>([]);
  const [form, setForm] = useState({ title: '', subject: '', durationMin: '60', lowThreshold: '30', mediumThreshold: '60', highThreshold: '80' });
  const [authForm, setAuthForm] = useState({ name: '', rollNumber: '', email: '', password: '', confirmPassword: '' });
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      // Old client-only profiles are not authenticated server sessions.
      if (!localStorage.getItem('anomalydash_token')) {
        localStorage.removeItem('anomalydash_user');
        return null;
      }
      return JSON.parse(localStorage.getItem('anomalydash_user') || 'null');
    } catch {
      localStorage.removeItem('anomalydash_user');
      localStorage.removeItem('anomalydash_token');
      return null;
    }
  });
  const [creating, setCreating] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [questionForm, setQuestionForm] = useState({ type: 'MCQ', prompt: '', marks: '1', options: '|||', answerKey: 'A' });
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [joinForm, setJoinForm] = useState({ testUrl: '', joinCode: '' });
  const [joinMessage, setJoinMessage] = useState('');
  const [joinError, setJoinError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [endingExam, setEndingExam] = useState(false);
  const [activeAttempt, setActiveAttempt] = useState<any | null>(null);
  const [activeExam, setActiveExam] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [examLoading, setExamLoading] = useState(false);
  const [examMessage, setExamMessage] = useState('');
  const [examError, setExamError] = useState('');
  const [anomalyScore, setAnomalyScore] = useState(0);
  const [anomalyLevel, setAnomalyLevel] = useState('CLEAR');
  const lastAnswerAt = useRef(0);
  const lastInteractionAt = useRef(Date.now());
  const fullscreenStarted = useRef(false);
  const awayStartedAt = useRef<number | null>(null);
  const questionStartedAt = useRef<Record<string, number>>({});
  const questionFirstResponseRecorded = useRef<Record<string, boolean>>({});
  const questionStartedEvents = useRef<Record<string, boolean>>({});
  const answerValues = useRef<Record<string, string>>({});
  const pendingMonitoringEvents = useRef<Array<{ type: string; metadata?: Record<string, unknown> }>>([]);
  const [facultyHistory, setFacultyHistory] = useState<any[]>([]);
  const [studentHistory, setStudentHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [liveMonitoring, setLiveMonitoring] = useState<any[]>([]);
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);

  const statusLabel = dbStatus === 'connected' ? 'Database connected' : dbStatus === 'checking' ? 'Checking database' : 'Database offline';

  const navigate = (nextView: View) => {
    const nextHash = nextView === 'home' ? '' : '#/' + nextView;
    window.history.pushState(null, '', nextHash);
    setView(nextView);
    window.scrollTo(0, 0);
  };

  const openAuth = (mode: AuthMode) => { setAuthMode(mode); navigate('login'); };

  const loadData = async () => {
    try {
      const examsUrl = currentUser?.role === 'FACULTY' ? `/api/exams?facultyId=${encodeURIComponent(currentUser.id)}` : '/api/exams';
      const response = await apiFetch(examsUrl);
      if (!response.ok) throw new Error();
      const data = await response.json();
      setExams(data);
      setDbStatus('connected');
    } catch { setDbStatus('offline'); }
  };

  useEffect(() => {
    void loadData();
    const onPopState = () => setView(getInitialView());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [currentUser?.id, currentUser?.role]);

  const createExam = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!form.title.trim() || !form.subject.trim() || !currentUser) return;
    setCreating(true);
    try {
      const response = await apiFetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, durationMin: Number(form.durationMin), lowThreshold: Number(form.lowThreshold), mediumThreshold: Number(form.mediumThreshold), highThreshold: Number(form.highThreshold), facultyId: currentUser.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not create test');
      setForm({ title: '', subject: '', durationMin: '60', lowThreshold: '10', mediumThreshold: '30', highThreshold: '60' });
      setSelectedExam(data);
      setExams(prev => [data, ...prev.filter(exam => exam.id !== data.id)]);
      void loadData();
    } catch (error) { setDbStatus('offline'); alert(error instanceof Error ? error.message : 'Could not create test'); }
    finally { setCreating(false); }
  };

  const addQuestion = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedExam || !questionForm.prompt.trim()) return;
    setAddingQuestion(true);
    try {
      const response = await apiFetch(`/api/exams/${selectedExam.id}/questions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...questionForm, marks: Number(questionForm.marks), options: questionForm.type === 'MCQ' ? questionForm.options.split('|').map(option => option.trim()).filter(Boolean).join('|') : '', answerKey: questionForm.type === 'MCQ' ? (questionForm.options.split('|').map(option => option.trim())[['A','B','C','D'].indexOf(questionForm.answerKey)] || '') : questionForm.answerKey })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not add question');
      setQuestionForm({ type: 'MCQ', prompt: '', marks: '1', options: '|||', answerKey: 'A' });
      const updatedExam = { ...selectedExam, _count: { questions: (selectedExam._count?.questions || 0) + 1 } };
      setSelectedExam(updatedExam);
      setExams(prev => prev.map(exam => exam.id === selectedExam.id ? updatedExam : exam));
      void loadData();
    } catch (error) { alert(error instanceof Error ? error.message : 'Could not add question'); }
    finally { setAddingQuestion(false); }
  };

  const endLiveSession = async () => {
    if (!selectedExam || selectedExam.status !== 'LIVE' || !currentUser) return;
    if (!window.confirm('End this live session? Students who have not started will be blocked, and active attempts will be closed.')) return;
    setEndingExam(true);
    try {
      const response = await apiFetch(`/api/exams/${selectedExam.id}/end`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facultyId: currentUser.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not end live session');
      const updatedExam = { ...selectedExam, status: 'COMPLETED' };
      setSelectedExam(updatedExam);
      setExams(prev => prev.map(exam => exam.id === selectedExam.id ? updatedExam : exam));
      void loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not end live session');
    } finally {
      setEndingExam(false);
    }
  };

  const deleteCompletedExam = async (exam: Exam) => {
    if (exam.status !== 'COMPLETED') return;
    if (!window.confirm('Permanently remove this completed test and its records?')) return;
    try {
      const response = await apiFetch('/api/exams/' + exam.id, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ facultyId: currentUser?.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not remove test');
      setExams(prev => prev.filter(item => item.id !== exam.id));
      if (selectedExam?.id === exam.id) setSelectedExam(null);
      alert('Completed test removed.');
    } catch (error) { alert(error instanceof Error ? error.message : 'Could not remove test'); }
  };

  const publishExam = async () => {
    if (!selectedExam) return;
    setPublishing(true);
    try {
      const response = await apiFetch(`/api/exams/${selectedExam.id}/publish`, { method: 'PATCH' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not publish test');
      const updatedExam = { ...selectedExam, status: 'LIVE' };
      setSelectedExam(updatedExam);
      setExams(prev => prev.map(exam => exam.id === selectedExam.id ? updatedExam : exam));
      void loadData();
    } catch (error) { alert(error instanceof Error ? error.message : 'Could not publish test'); }
    finally { setPublishing(false); }
  };

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();
    setJoinError(''); setJoinMessage('');
    try {
      const response = await apiFetch('/api/exams/join', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(joinForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not join test');
      setJoinMessage(`Test verified: ${data.exam.title}. Your exam is ready to begin.`);
      await openExam(data.exam.id, data.exam.joinCode);
    } catch (error) { setJoinError(error instanceof Error ? error.message : 'Could not join test'); }
  };

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault(); setAuthError(''); setAuthSuccess('');
    if (authMode === 'signup' && authForm.password !== authForm.confirmPassword) { setAuthError('Passwords do not match.'); return; }
    setAuthLoading(true);
    try {
      const response = await apiFetch(authMode === 'signup' ? '/api/auth/signup' : '/api/auth/signin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: authForm.name, rollNumber: authForm.rollNumber, email: authForm.email, password: authForm.password, role: role.toUpperCase() })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Authentication failed (${response.status})`);
      if (!data.user) throw new Error('Authentication succeeded but no user session was returned.');
      if (typeof data.token !== 'string' || !data.token) throw new Error('Authentication succeeded without a valid session token.');
      localStorage.setItem('anomalydash_token', data.token);
      localStorage.setItem('anomalydash_user', JSON.stringify(data.user));
      setCurrentUser(data.user); setAuthSuccess(authMode === 'signin' ? 'Sign in successful. Opening your dashboard…' : 'Account created successfully. Opening your dashboard…'); setAuthForm({ name: '', rollNumber: '', email: '', password: '', confirmPassword: '' });
      navigate(role);
    } catch (error) { const message = error instanceof Error ? error.message : 'Authentication failed'; setAuthError(message); console.error('AnomalyDash authentication error:', error); }
    finally { setAuthLoading(false); }
  };


  const openExam = async (examId: string, joinCode: string) => {
    if (!currentUser || currentUser.role !== 'STUDENT') return;
    setExamLoading(true); setExamError(''); setExamMessage('');
    try {
      const response = await apiFetch(`/api/exams/${examId}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: currentUser.id, joinCode }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not start exam');
      setActiveAttempt(data.attempt);
      setActiveExam(data.exam);
      const restoredAnswers = Object.fromEntries((data.attempt.answers || []).map((a: any) => [a.questionId, a.answer]));
      setAnswers(restoredAnswers);
      answerValues.current = restoredAnswers;
      questionStartedAt.current = {};
      questionFirstResponseRecorded.current = {};
      questionStartedEvents.current = {};
      awayStartedAt.current = null;
      pendingMonitoringEvents.current = [];
      setRemainingSeconds(Math.max(0, Math.floor((new Date(data.attempt.expiresAt).getTime() - Date.now()) / 1000)));
      setAnomalyScore(data.attempt.anomalyScore || 0);
      setAnomalyLevel(data.attempt.anomalyLevel || 'CLEAR');
      // Enter the exam view directly without triggering the hashchange listener.
      window.history.pushState(null, '', '#/exam');
      setView('exam');
      window.scrollTo(0, 0);
    } catch (error) { setExamError(error instanceof Error ? error.message : 'Could not start exam'); }
    finally { setExamLoading(false); }
  };

  const recordMonitoringEvent = async (type: string, metadata?: Record<string, unknown>) => {
    if (!activeAttempt || activeAttempt.status !== 'IN_PROGRESS') return;
    try {
      const response = await apiFetch('/api/attempts/' + activeAttempt.id + '/monitoring-events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, metadata })
      });
      if (!response.ok) return;
      const data = await response.json();
      setAnomalyScore(data.anomalyScore ?? 0);
      setAnomalyLevel(data.anomalyLevel ?? 'CLEAR');
      if (type === 'ONLINE' && pendingMonitoringEvents.current.length > 0) {
        const queued = pendingMonitoringEvents.current.splice(0);
        for (let index = 0; index < queued.length; index += 1) {
          try {
            const pending = queued[index];
            const queuedResponse = await apiFetch('/api/attempts/' + activeAttempt.id + '/monitoring-events', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(pending)
            });
            if (!queuedResponse.ok) throw new Error('Could not flush queued monitoring event');
          } catch {
            pendingMonitoringEvents.current.push(...queued.slice(index));
            break;
          }
        }
      }
    } catch {
      if (type !== 'ONLINE') pendingMonitoringEvents.current.push({ type, metadata });
      /* Monitoring must never interrupt the exam. Failed events are queued for reconnection. */
    }
  };

  useEffect(() => {
    if (view !== 'exam' || !activeAttempt || activeAttempt.status !== 'IN_PROGRESS') return;
    lastInteractionAt.current = Date.now();
    fullscreenStarted.current = Boolean(document.fullscreenElement);
    const onVisibility = () => {
      if (document.hidden) {
        if (awayStartedAt.current === null) awayStartedAt.current = Date.now();
        void recordMonitoringEvent('TAB_HIDDEN');
      } else {
        const awayDurationMs = awayStartedAt.current === null ? 0 : Math.max(0, Date.now() - awayStartedAt.current);
        awayStartedAt.current = null;
        void recordMonitoringEvent('TAB_VISIBLE', { awayDurationMs });
      }
    };
    const onBlur = () => {
      if (awayStartedAt.current === null) awayStartedAt.current = Date.now();
      void recordMonitoringEvent('FOCUS_LOST');
    };
    const onFocus = () => {
      const awayDurationMs = awayStartedAt.current === null ? 0 : Math.max(0, Date.now() - awayStartedAt.current);
      awayStartedAt.current = null;
      void recordMonitoringEvent('FOCUS_REGAINED', { awayDurationMs });
    };
    const onPaste = () => void recordMonitoringEvent('PASTE');
    const onCopy = () => void recordMonitoringEvent('COPY');
    const onOffline = () => void recordMonitoringEvent('OFFLINE');
    const onOnline = () => void recordMonitoringEvent('ONLINE');
    const onActivity = () => { lastInteractionAt.current = Date.now(); };
    const onFullscreen = () => {
      if (fullscreenStarted.current && !document.fullscreenElement) void recordMonitoringEvent('FULLSCREEN_EXIT');
      if (document.fullscreenElement) fullscreenStarted.current = true;
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('paste', onPaste);
    document.addEventListener('copy', onCopy);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    document.addEventListener('mousemove', onActivity);
    document.addEventListener('keydown', onActivity);
    document.addEventListener('click', onActivity);
    document.addEventListener('fullscreenchange', onFullscreen);
    const idleTimer = window.setInterval(() => {
      if (Date.now() - lastInteractionAt.current >= 60000) {
        lastInteractionAt.current = Date.now();
        void recordMonitoringEvent('LONG_IDLE', { thresholdSeconds: 60 });
      }
    }, 10000);
    return () => {
      window.clearInterval(idleTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('copy', onCopy);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('mousemove', onActivity);
      document.removeEventListener('keydown', onActivity);
      document.removeEventListener('click', onActivity);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [view, activeAttempt?.id, activeAttempt?.status]);

  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      fullscreenStarted.current = true;
    } catch {
      setExamMessage('Fullscreen was not enabled. You can continue the exam normally.');
    }
  };

  useEffect(() => {
    setCurrentQuestionIndex(0);
    if (activeExam?.questions?.[0]?.id) questionStartedAt.current[activeExam.questions[0].id] = Date.now();
  }, [activeExam?.id]);

  useEffect(() => {
    const question = activeExam?.questions?.[currentQuestionIndex];
    if (view === 'exam' && activeAttempt?.status === 'IN_PROGRESS' && question?.id && questionStartedAt.current[question.id] === undefined) {
      questionStartedAt.current[question.id] = Date.now();
    }
  }, [view, activeExam?.id, currentQuestionIndex, activeAttempt?.status]);

  const goToQuestion = (nextIndex: number) => {
    if (!activeExam || !activeAttempt) return;
    const question = activeExam.questions[currentQuestionIndex];
    if (question && !String(answerValues.current[question.id] || '').trim()) {
      void recordMonitoringEvent('SKIPPED_QUESTION', { questionId: question.id, questionNumber: currentQuestionIndex + 1, direction: nextIndex > currentQuestionIndex ? 'next' : 'previous' });
    }
    setCurrentQuestionIndex(Math.max(0, Math.min(activeExam.questions.length - 1, nextIndex)));
  };

  const saveAnswer = async (questionId: string, answer: string) => {
    if (!activeAttempt) return;
    const now = Date.now();
    if (!questionStartedEvents.current[questionId]) {
      questionStartedEvents.current[questionId] = true;
      if (questionStartedAt.current[questionId] === undefined) questionStartedAt.current[questionId] = now;
      void recordMonitoringEvent('ANSWER_STARTED', { questionId });
    }
    const previousAnswer = answerValues.current[questionId] || '';
    if (previousAnswer !== answer) {
      const firstResponse = !questionFirstResponseRecorded.current[questionId] && Boolean(answer.trim());
      const responseTimeMs = Math.max(0, now - (questionStartedAt.current[questionId] ?? now));
      void recordMonitoringEvent('ANSWER_CHANGED', { questionId, answerLength: answer.length, changedFromExisting: Boolean(previousAnswer), firstResponse, responseTimeMs });
      if (firstResponse) questionFirstResponseRecorded.current[questionId] = true;
      answerValues.current[questionId] = answer;
    }
    if (now - lastAnswerAt.current < 1200 && lastAnswerAt.current > 0) void recordMonitoringEvent('RAPID_ANSWERS', { intervalMs: now - lastAnswerAt.current });
    lastAnswerAt.current = now;
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    try {
      const response = await apiFetch(`/api/attempts/${activeAttempt.id}/answers`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId, answer }) });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setExamError(data.message || 'Could not save answer');
      }
    } catch { setExamError('Connection lost while saving your answer.'); }
  };

  const submitExam = async (auto = false) => {
    if (!activeAttempt) return;
    setExamLoading(true); setExamError('');
    try {
      await recordMonitoringEvent('ANSWER_SUBMITTED', { answeredQuestionCount: Object.values(answerValues.current).filter(value => String(value || '').trim()).length });
      const response = await apiFetch(`/api/attempts/${activeAttempt.id}/submit`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not submit exam');
      setActiveAttempt(data.attempt);
      setExamMessage(auto ? `Time is up. Your exam was submitted automatically. Score: ${data.score}` : `Exam submitted successfully. Score: ${data.score}`);
    } catch (error) { setExamError(error instanceof Error ? error.message : 'Could not submit exam'); }
    finally { setExamLoading(false); }
  };

  useEffect(() => {
    if (!activeAttempt || activeAttempt.status !== 'IN_PROGRESS') return;
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.floor((new Date(activeAttempt.expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(seconds);
      if (seconds <= 0) {
        window.clearInterval(timer);
        void submitExam(true);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeAttempt?.id, activeAttempt?.expiresAt, activeAttempt?.status]);

  useEffect(() => {
    if (view !== 'faculty-monitoring' || !selectedExam || selectedExam.status !== 'LIVE') {
      setLiveMonitoring([]);
      return;
    }
    let cancelled = false;
    const loadMonitoring = async () => {
      try {
        const response = await apiFetch('/api/exams/' + selectedExam.id + '/monitoring?facultyId=' + encodeURIComponent(currentUser?.id || ''));
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setLiveMonitoring(data);
      } catch { /* live monitoring is best effort */ }
    };
    void loadMonitoring();
    const timer = window.setInterval(() => void loadMonitoring(), 1500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [view, selectedExam?.id, selectedExam?.status]);

  const loadFacultyHistory = async () => {
    if (!currentUser || currentUser.role !== 'FACULTY') return;
    setHistoryLoading(true);
    try {
      const response = await apiFetch(`/api/faculty/${currentUser.id}/history`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load history');
      setFacultyHistory(data);
    } catch (error) { alert(error instanceof Error ? error.message : 'Could not load history'); }
    finally { setHistoryLoading(false); }
  };

  const loadStudentHistory = async () => {
    if (!currentUser || currentUser.role !== 'STUDENT') return;
    setHistoryLoading(true);
    try {
      const response = await apiFetch(`/api/students/${currentUser.id}/history`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load history');
      setStudentHistory(data);
    } catch (error) { alert(error instanceof Error ? error.message : 'Could not load history'); }
    finally { setHistoryLoading(false); }
  };

  const logout = () => {
    void apiFetch('/api/auth/signout', { method: 'POST' }).catch(() => undefined);
    localStorage.removeItem('anomalydash_token');
    localStorage.removeItem('anomalydash_user');
    setCurrentUser(null);
    navigate('home');
  };

  return (
    <main className={`app-shell theme-${theme}`} style={{ '--font-scale': fontScale } as CSSProperties}>
      <nav className="topbar">
        <button className="brand brand-button" onClick={() => navigate('home')}><div className="brand-mark">A/</div><div><strong>AnomalyDash</strong><span>by CodeMatriX</span></div></button>
        <div className="nav-actions">
          <button className={`nav-link ${view === 'home' ? 'active' : ''}`} onClick={() => navigate('home')}>Overview</button>
          {currentUser?.role === 'FACULTY' && <><button className={`nav-link ${view === 'faculty' ? 'active' : ''}`} onClick={() => navigate('faculty')}>Faculty</button><button className={`nav-link ${view === 'faculty-monitoring' ? 'active' : ''}`} onClick={() => navigate('faculty-monitoring')}>Live Monitoring</button><button className={`nav-link ${view === 'faculty-history' ? 'active' : ''}`} onClick={() => { navigate('faculty-history'); void loadFacultyHistory(); }}>History</button></>}
          {currentUser?.role === 'STUDENT' && <><button className={`nav-link ${view === 'student' ? 'active' : ''}`} onClick={() => navigate('student')}>Student</button><button className={`nav-link ${view === 'student-history' ? 'active' : ''}`} onClick={() => { navigate('student-history'); void loadStudentHistory(); }}>Past Exams</button></>}
          {currentUser && <button className="nav-link" onClick={logout}>Sign out</button>}
        </div>
      </nav>

      <div className="accessibility-wrap">
        <button type="button" className="accessibility-trigger" aria-label="Accessibility settings" title="Accessibility settings" aria-expanded={accessibilityOpen} aria-controls="accessibility-panel" onClick={() => setAccessibilityOpen(open => !open)}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="4.5" r="2"/><path d="M4 8.5h16M12 8.5v5m0 0-4 6m4-6 4 6M7 8.5l2 4m8-4-2 4"/></svg>
        </button>
        {accessibilityOpen && <section className="accessibility-panel" id="accessibility-panel" aria-label="Accessibility settings">
          <div className="accessibility-panel-heading"><strong>Accessibility</strong><button type="button" className="accessibility-close" aria-label="Close accessibility settings" onClick={() => setAccessibilityOpen(false)}>×</button></div>
          <div className="accessibility-setting"><div><strong>Light theme</strong><span>Switch the website appearance</span></div><button type="button" role="switch" aria-label="Light theme" aria-checked={theme === 'light'} className={`theme-switch ${theme === 'light' ? 'is-light' : ''}`} onClick={() => setTheme(current => current === 'light' ? 'dark' : 'light')}><span /></button></div>
          <div className="accessibility-setting font-setting"><div><strong>Text size</strong><span>Adjust text across the website</span></div><div className="font-controls"><button type="button" aria-label="Decrease font size" disabled={fontScale <= 0.9} onClick={() => setFontScale(size => Math.max(0.9, Math.round((size - 0.1) * 10) / 10))}>A−</button><span>{Math.round(fontScale * 100)}%</span><button type="button" aria-label="Increase font size" disabled={fontScale >= 1.3} onClick={() => setFontScale(size => Math.min(1.3, Math.round((size + 0.1) * 10) / 10))}>A+</button></div></div>
        </section>}
      </div>

      {view === 'home' && <><section className="hero"><div className="hero-copy"><div className="eyebrow">INTELLIGENT EXAMINATION MONITORING</div><h1>Exams, made<br /><em>more intelligent.</em></h1><p>AnomalyDash helps colleges conduct online examinations while turning unusual behaviour and answering patterns into explainable signals for faculty review.</p><div className="hero-actions"><button className="primary" onClick={() => currentUser ? navigate(currentUser.role === 'FACULTY' ? 'faculty' : 'student') : openAuth('signin')}>{currentUser ? 'Open Dashboard' : 'Get Started'} <span>→</span></button></div><div className="trust-line"><span>●</span> Faculty stays in control · Minimum-data monitoring · No webcam required</div></div><div className="hero-visual"><div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" /><div className="floating-logo"><span>A/</span><small>ANOMALYDASH</small></div><div className="visual-caption">Intelligent Examination Monitoring</div></div></section><section className="overview-grid"><article className="overview-card featured"><span className="card-number">01</span><h2>Conduct exams normally.</h2><p>Questions, marks, duration and student responses live inside one structured examination workflow.</p></article><article className="overview-card"><span className="card-number">02</span><h2>Observe meaningful signals.</h2><p>Focus changes, visibility events, timing shifts and paste metadata are captured without webcam or microphone surveillance.</p></article><article className="overview-card"><span className="card-number">03</span><h2>Investigate, don't assume.</h2><p>Combined evidence highlights unusual sessions while keeping the final decision with faculty.</p></article></section></>}

      {view === 'login' && <section className="auth-page"><div className="auth-card"><span className="eyebrow">ANOMALYDASH ACCESS</span><h1>{authMode === 'signin' ? 'Welcome back' : 'Create your account'}</h1><p className="auth-subtitle">{authMode === 'signin' ? 'Sign in to continue to your AnomalyDash workspace.' : 'Create your AnomalyDash account to get started.'}</p><div className="role-switch"><button className={authMode === 'signin' ? 'selected' : ''} onClick={() => setAuthMode('signin')}>Sign In</button><button className={authMode === 'signup' ? 'selected' : ''} onClick={() => setAuthMode('signup')}>Sign Up</button></div><div className="role-switch"><button className={role === 'faculty' ? 'selected' : ''} onClick={() => setRole('faculty')}>Faculty</button><button className={role === 'student' ? 'selected' : ''} onClick={() => setRole('student')}>Student</button></div><form onSubmit={handleAuth}>{authMode === 'signup' && <label>Full name<input required value={authForm.name} onChange={e => setAuthForm({...authForm,name:e.target.value})} placeholder="Enter your full name" /></label>}{role === 'student' && <label>Roll number<input required value={authForm.rollNumber} onChange={e => setAuthForm({...authForm,rollNumber:e.target.value})} placeholder="Enter your college roll number" /></label>}<label>Email address<input type="email" required value={authForm.email} onChange={e => setAuthForm({...authForm,email:e.target.value})} placeholder={role === 'faculty' ? 'faculty@college.edu' : 'student@college.edu'} /></label><label>Password<input type="password" required minLength={6} value={authForm.password} onChange={e => setAuthForm({...authForm,password:e.target.value})} placeholder="Enter your password" /></label>{authMode === 'signup' && <label>Confirm password<input type="password" required minLength={6} value={authForm.confirmPassword} onChange={e => setAuthForm({...authForm,confirmPassword:e.target.value})} placeholder="Confirm your password" /></label>}<button className="primary full" type="submit" disabled={authLoading}>{authLoading ? 'Authenticating…' : authMode === 'signin' ? 'Sign in' : 'Create account'} as {role === 'faculty' ? 'Faculty' : 'Student'} <span>→</span></button></form>{authError && <div className="auth-error" role="alert"><strong>Authentication failed</strong><span>{authError}</span></div>}{authSuccess && <div className="auth-success" role="status">{authSuccess}</div>}<p className="auth-note">Your credentials are verified against the AnomalyDash database before entering your role workspace.</p><button className="back-link" onClick={() => navigate('home')}>← Back to overview</button></div></section>}

      {view === 'faculty' && currentUser?.role === 'FACULTY' && <section className="page workspace"><div className="page-topbar"><button className="overview-back" type="button" onClick={() => navigate('home')}>← Back to Overview</button></div><div className="page-heading"><div><span className="eyebrow">FACULTY DASHBOARD</span><h1>Create and publish tests.</h1><p>Welcome, {currentUser.name}. Build a test, add questions, then publish it to generate a student-ready join flow.</p></div><button className="secondary" onClick={logout}>Sign out</button></div><div className="workspace-grid"><form className="form-card" onSubmit={createExam}><span className="label">PHASE 3 · TEST BUILDER</span><h2>New test</h2><p>Create the examination record first. A unique test code and URL are generated automatically.</p><label>Test name<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Data Structures Mid Term" /></label><label>Subject<input required value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="e.g. Data Structures" /></label><label>Duration (minutes)<input type="number" min="1" max="300" required value={form.durationMin} onChange={e=>setForm({...form,durationMin:e.target.value})} /></label><div className="threshold-config"><span className="label">ANOMALY THRESHOLDS · 1–100</span><p>Choose when a score becomes Low, Medium or High. Keep values in ascending order.</p><label>Low from<input type="number" min="1" max="99" required value={form.lowThreshold} onChange={e=>setForm({...form,lowThreshold:e.target.value})} /></label><label>Medium from<input type="number" min="2" max="100" required value={form.mediumThreshold} onChange={e=>setForm({...form,mediumThreshold:e.target.value})} /></label><label>High from<input type="number" min="3" max="100" required value={form.highThreshold} onChange={e=>setForm({...form,highThreshold:e.target.value})} /></label>{!(Number(form.lowThreshold)<Number(form.mediumThreshold)&&Number(form.mediumThreshold)<Number(form.highThreshold))&&<small className="threshold-error">Set thresholds in ascending order: Low &lt; Medium &lt; High.</small>}</div><button className="primary full" disabled={creating || dbStatus !== 'connected'}>{creating ? 'Creating test…' : 'Create new test →'}</button></form><div className="data-card"><div className="data-card-heading"><div><span className="label">MY TESTS</span><h2>{exams.filter(e=>e.status !== 'COMPLETED').length} records</h2></div><span className="connected-badge">{dbStatus === 'connected' ? 'CONNECTED' : 'OFFLINE'}</span></div>{exams.map(exam=><div className={`exam-row ${selectedExam?.id === exam.id ? 'selected-row' : ''}`} key={exam.id} onClick={()=>setSelectedExam(exam)}><div><strong>{exam.title}</strong><span>{exam.subject} · {exam.durationMin} min · {exam._count?.questions ?? 0} questions</span>{exam.status === 'LIVE' && exam.joinCode && <small>Code: <b>{exam.joinCode}</b></small>}</div><b>{exam.status}</b></div>)}</div></div>{selectedExam && <section className="builder-panel"><div className="builder-head"><div><span className="label">TEST CONFIGURATION</span><h2>{selectedExam.title}</h2><p>{selectedExam.status === 'LIVE' ? 'This test is live. Students can join using the code and URL below.' : 'Add at least one question, then publish this test.'}</p></div>{selectedExam.status === 'LIVE' && <div className="test-credentials"><span>TEST CODE <b>{selectedExam.joinCode}</b></span><span>TEST URL <b>{selectedExam.accessUrl}</b></span></div>}</div>{selectedExam.status === 'DRAFT' && <form className="question-form" onSubmit={addQuestion}><label>Question type<select value={questionForm.type} onChange={e=>setQuestionForm({...questionForm,type:e.target.value})}><option value="MCQ">Multiple choice</option><option value="DESCRIPTIVE">Descriptive</option></select></label><label>Question<input required value={questionForm.prompt} onChange={e=>setQuestionForm({...questionForm,prompt:e.target.value})} placeholder="Enter the question" /></label><label>Marks<input type="number" min="1" required value={questionForm.marks} onChange={e=>setQuestionForm({...questionForm,marks:e.target.value})} /></label>{questionForm.type === 'MCQ' && <><div className="mcq-option-fields"><span className="field-label">Answer options</span>{['A','B','C','D'].map((letter,index)=><label key={letter}>Option {letter}<input required={index < 2} value={(questionForm.options.split('|')[index] || '')} onChange={e=>{const options=questionForm.options.split('|'); while(options.length<4) options.push(''); options[index]=e.target.value; setQuestionForm({...questionForm,options:options.slice(0,4).join('|')});}} placeholder={`Enter option ${letter}`} /></label>)}</div><label>Correct option<select required value={questionForm.answerKey} onChange={e=>setQuestionForm({...questionForm,answerKey:e.target.value})}><option value="A">Option A</option><option value="B">Option B</option><option value="C">Option C</option><option value="D">Option D</option></select></label><p className="form-hint">Choose the correct option. MCQs are graded automatically when students submit.</p></>}<button className="primary" disabled={addingQuestion}>{addingQuestion ? 'Adding…' : 'Add question'}</button></form>}{selectedExam.status !== 'DRAFT' && <div className="published-lock-note">🔒 This test is published. Questions are locked and can no longer be changed.</div>}<div className="builder-footer"><span>{selectedExam._count?.questions ?? 0} question(s) added</span>{selectedExam.status === 'DRAFT' && <button className="primary" disabled={publishing || endingExam} onClick={publishExam}>{publishing ? 'Publishing…' : 'Publish test →'}</button>}
{selectedExam.status === 'LIVE' && <button type="button" className="secondary danger-action" disabled={endingExam} onClick={()=>void endLiveSession()}>{endingExam ? 'Ending session…' : 'End live session'}</button>}{selectedExam.status === 'COMPLETED' && <button type="button" className="secondary danger-action" onClick={()=>void deleteCompletedExam(selectedExam)}>Remove completed test</button>}</div></section>}{selectedExam?.status === 'LIVE' && <section className="monitoring-launch"><div><span className="label">PHASE 5 · ANOMALY MONITORING</span><h2>Monitor this live examination.</h2><p>Open the dedicated monitoring screen to watch student behaviour signals in near real time.</p></div><button className="primary" type="button" onClick={() => navigate('faculty-monitoring')}>Open live monitoring →</button></section>}</section>}

      {view === 'faculty-monitoring' && currentUser?.role === 'FACULTY' && <section className="page workspace monitoring-page">
        <div className="page-topbar"><button className="overview-back" type="button" onClick={() => navigate('faculty')}>← Back to Faculty Dashboard</button></div>
        <div className="page-heading"><div><span className="eyebrow">PHASE 5 · LIVE ANOMALY MONITORING</span><h1>Watch live examinations.</h1><p>Student behaviour signals are refreshed every 1.5 seconds. Use these indicators for faculty review, not as automatic proof of misconduct.</p></div><span className="monitoring-live">● LIVE FEED</span></div>
        <div className="monitoring-toolbar"><label>Select live examination<select value={selectedExam?.id || ''} onChange={e=>setSelectedExam(exams.find(exam=>exam.id===e.target.value) || null)}><option value="">Choose a live exam</option>{exams.filter(exam=>exam.status === 'LIVE').map(exam=><option key={exam.id} value={exam.id}>{exam.title} · {exam.subject}</option>)}</select></label><div className="monitoring-refresh"><span>● AUTO REFRESH</span><b>1.5s</b></div>{selectedExam && <div className="monitoring-threshold-summary">Risk thresholds: <b>Low {selectedExam.lowThreshold ?? 30}+</b> · <b>Medium {selectedExam.mediumThreshold ?? 60}+</b> · <b>High {selectedExam.highThreshold ?? 80}+</b></div>}</div>
        {!selectedExam ? <div className="monitoring-empty monitoring-empty-large">Select a LIVE examination above to start the monitoring feed.</div> : <><div className="monitoring-stats"><div><span>ACTIVE STUDENTS</span><b>{liveMonitoring.filter(a=>a.status === 'IN_PROGRESS').length}</b></div><div><span>HIGH RISK</span><b className="anomaly-high">{liveMonitoring.filter(a=>a.anomalyLevel === 'HIGH').length}</b></div><div><span>MEDIUM RISK</span><b className="anomaly-medium">{liveMonitoring.filter(a=>a.anomalyLevel === 'MEDIUM').length}</b></div><div><span>SIGNALS</span><b>{liveMonitoring.reduce((total,a)=>total+(a.events?.length || 0),0)}</b></div></div>
        {liveMonitoring.length === 0 ? <div className="monitoring-empty monitoring-empty-large">No students have started this test yet. The feed will update automatically when an attempt begins.</div> : <div style={{overflowX:'auto',border:'1px solid var(--line, #e5e7eb)',borderRadius:12,background:'var(--surface, #fff)'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left',minWidth:850}}><thead><tr>{['Student','Roll Number','Status','Anomaly Score','Anomaly Level','Latest Signal','Recent Signals','Evidence'].map(heading=><th key={heading} style={{padding:'14px 16px',fontSize:12,letterSpacing:'.04em',textTransform:'uppercase',borderBottom:'1px solid var(--line, #e5e7eb)',whiteSpace:'nowrap',color:'var(--muted, #64748b)'}}>{heading}</th>)}</tr></thead><tbody>{[...liveMonitoring].sort((a:any,b:any)=>b.anomalyScore-a.anomalyScore).map((attempt:any)=><Fragment key={attempt.id}><tr style={{background:attempt.anomalyLevel==='HIGH'?'rgba(220,38,38,.045)':'transparent'}}><td style={{padding:'14px 16px',borderBottom:'1px solid var(--line, #e5e7eb)',fontWeight:600}}>{attempt.student.name}</td><td style={{padding:'14px 16px',borderBottom:'1px solid var(--line, #e5e7eb)'}}>{attempt.student.rollNumber || '—'}</td><td style={{padding:'14px 16px',borderBottom:'1px solid var(--line, #e5e7eb)',whiteSpace:'nowrap'}}>{attempt.status.replaceAll('_',' ')}</td><td style={{padding:'14px 16px',borderBottom:'1px solid var(--line, #e5e7eb)',fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{attempt.anomalyScore}/100</td><td style={{padding:'14px 16px',borderBottom:'1px solid var(--line, #e5e7eb)',fontWeight:700,whiteSpace:'nowrap'}}><span className={"monitor-"+String(attempt.anomalyLevel).toLowerCase()}>{attempt.anomalyLevel}</span></td><td style={{padding:'14px 16px',borderBottom:'1px solid var(--line, #e5e7eb)',whiteSpace:'nowrap'}}>{attempt.events?.[0]?.type?.replaceAll('_',' ') || 'None'}</td><td style={{padding:'14px 16px',borderBottom:'1px solid var(--line, #e5e7eb)',minWidth:220}}>{Object.entries((attempt.events || []).reduce((counts:any,event:any)=>{counts[event.type]=(counts[event.type]||0)+1;return counts;},{})).map(([type,count])=>`${type.replaceAll('_',' ')} ×${count}`).join(' · ') || 'No signals recorded'}</td><td style={{padding:'14px 16px',borderBottom:'1px solid var(--line, #e5e7eb)'}}><button type="button" className="secondary evidence-toggle" aria-expanded={expandedAttemptId===attempt.id} onClick={()=>setExpandedAttemptId(current=>current===attempt.id?null:attempt.id)}>{expandedAttemptId===attempt.id?'Hide':'Inspect'} ({attempt.events?.length || 0})</button></td></tr>{expandedAttemptId===attempt.id&&<tr><td colSpan={8} className="evidence-cell"><div className="evidence-panel"><strong>Behaviour feature summary · {attempt.student.name}</strong>{attempt.features ? <div className="monitoring-stats"><div><span>Tab switches</span><b>{attempt.features.tabSwitchCount}</b></div><div><span>Focus losses</span><b>{attempt.features.focusLossCount}</b></div><div><span>Total away</span><b>{Math.round(attempt.features.totalAwayMs/1000)}s</b></div><div><span>Max away</span><b>{Math.round(attempt.features.maxAwayMs/1000)}s</b></div><div><span>Paste events</span><b>{attempt.features.pasteCount}</b></div><div><span>Answer changes</span><b>{attempt.features.answerChangeCount}</b></div><div><span>Avg response</span><b>{Math.round(attempt.features.averageResponseMs/1000)}s</b></div><div><span>Response deviation</span><b>{Math.round(attempt.features.responseTimeDeviationMs/1000)}s</b></div><div><span>Skipped</span><b>{attempt.features.skippedQuestionCount}</b></div><div><span>Unanswered</span><b>{attempt.features.unansweredQuestionCount}</b></div></div> : <p>Feature summary will appear when the backend has processed this attempt.</p>}<strong>Evidence timeline · {attempt.student.name}</strong>{(attempt.events||[]).length===0?<p>No monitoring signals recorded for this attempt.</p>:<ol>{attempt.events.map((event:any)=><li key={event.id}><div><b>{event.type.replaceAll('_',' ')}</b><time>{new Date(event.createdAt).toLocaleString()}</time></div><p>{event.metadata ? (()=>{try{return Object.entries(JSON.parse(event.metadata)).map(([key,value])=>`${key}: ${String(value)}`).join(' · ')}catch{return event.metadata}})() : 'No additional event metadata was recorded.'}</p></li>)}</ol>}<p className="evidence-disclaimer">These are behavioural signals for faculty review, not proof of misconduct.</p></div></td></tr>}</Fragment>)}</tbody></table></div>}</>}
      </section>}

      {view === 'faculty-history' && currentUser?.role === 'FACULTY' && <section className="page workspace"><div className="page-topbar"><button className="overview-back" type="button" onClick={() => navigate('home')}>← Back to Overview</button></div><div className="page-heading"><div><span className="eyebrow">FACULTY HISTORY</span><h1>Past examinations.</h1><p>Review completed tests, participating students, scores and recorded anomaly signals.</p></div><button className="secondary" onClick={()=>void loadFacultyHistory()}>Refresh history</button></div>{historyLoading ? <div className="data-card"><p>Loading examination history…</p></div> : facultyHistory.length === 0 ? <div className="data-card"><p>No completed examinations yet.</p></div> : <div className="history-list">{facultyHistory.map((exam:any)=><article className="history-card" key={exam.id}><div className="history-card-head"><div><span className="label">COMPLETED TEST</span><h2>{exam.title}</h2><p>{exam.subject} · {exam.durationMin} min · {exam.attempts.length} student attempt(s)</p></div><span className="history-status">COMPLETED</span></div><div className="history-attempts">{exam.attempts.length === 0 ? <p>No student attempts recorded.</p> : exam.attempts.map((attempt:any)=><div className="history-attempt" key={attempt.id}><div><strong>{attempt.student.name}</strong><span>{attempt.student.rollNumber || attempt.student.email}</span></div><div><b>{attempt.score ?? 0} marks</b><span>{attempt.status}</span></div><div><b className={attempt.anomalyLevel === 'HIGH' ? 'anomaly-high' : attempt.anomalyLevel === 'MEDIUM' ? 'anomaly-medium' : 'anomaly-clear'}>{attempt.anomalyLevel} · {attempt.anomalyScore}</b><span>Anomaly score</span></div></div>)}</div></article>)}</div>}</section>}

      {view === 'exam' && currentUser?.role === 'STUDENT' && activeExam && activeAttempt && <section className="page workspace exam-page"><div className="page-heading"><div><span className="eyebrow">LIVE EXAMINATION</span><h1>{activeExam.title}</h1><p>{activeExam.subject} · {activeExam.questions.length} questions · {currentUser.name}</p></div><div className="exam-monitor"><span className="monitor-level">EXAM IN PROGRESS</span><button type="button" className="monitor-fullscreen" onClick={()=>void enterFullscreen()}>Enter fullscreen</button></div><div className="exam-timer">{Math.floor(remainingSeconds / 60).toString().padStart(2,'0')}:{(remainingSeconds % 60).toString().padStart(2,'0')}</div></div>{examError && <div className="join-feedback error">{examError}</div>}{examMessage ? <div className="join-feedback success">{examMessage}<button className="secondary" onClick={()=>navigate('student')}>Return to dashboard</button></div> : <>{activeExam.questions.length > 0 && (() => { const q=activeExam.questions[currentQuestionIndex]; if (!q) return null; return <><div className="exam-progress"><span>Question {currentQuestionIndex+1} of {activeExam.questions.length}</span><div className="exam-progress-track"><div className="exam-progress-fill" style={{width:`${((currentQuestionIndex+1)/activeExam.questions.length)*100}%`}} /></div><span>{Object.keys(answers).filter(id=>String(answers[id] || '').trim()).length} answered</span></div><div className="exam-questions"><article className="question-card" key={q.id}><div className="question-meta"><span>QUESTION {currentQuestionIndex+1}</span><b>{q.marks} mark{q.marks === 1 ? '' : 's'}</b></div><h2>{q.prompt}</h2>{q.type === 'MCQ' ? <div className="option-list">{String(q.options || '').split('|').map((option:string,i:number)=>{const value=option.trim(); return value ? <label className={answers[q.id] === value ? 'option selected' : 'option'} key={i}><input type="radio" name={q.id} checked={answers[q.id] === value} onChange={()=>void saveAnswer(q.id,value)} />{value}</label> : null;})}</div> : <textarea className="answer-box" value={answers[q.id] || ''} onChange={e=>void saveAnswer(q.id,e.target.value)} placeholder="Type your answer here..." />}</article></div><div className="exam-question-nav"><button type="button" className="secondary" disabled={currentQuestionIndex===0} onClick={()=>goToQuestion(currentQuestionIndex-1)}>← Previous</button><span>{currentQuestionIndex === activeExam.questions.length-1 ? 'You have reached the last question.' : 'Your answer is saved automatically.'}</span>{currentQuestionIndex < activeExam.questions.length-1 ? <button type="button" className="primary" onClick={()=>goToQuestion(currentQuestionIndex+1)}>Next question →</button> : <button className="primary" disabled={examLoading} onClick={()=>void submitExam()}>{examLoading ? 'Submitting…' : 'Submit exam →'}</button>}</div></>; })()}</>}</section>}

      {view === 'student-history' && currentUser?.role === 'STUDENT' && <section className="page workspace"><div className="page-topbar"><button className="overview-back" type="button" onClick={() => navigate('home')}>← Back to Overview</button></div><div className="page-heading"><div><span className="eyebrow">PAST EXAMS</span><h1>Your examination history.</h1><p>Review the tests you have completed and the results recorded for each attempt.</p></div><button className="secondary" onClick={()=>void loadStudentHistory()}>Refresh history</button></div>{historyLoading ? <div className="data-card"><p>Loading past exams…</p></div> : studentHistory.length === 0 ? <div className="data-card"><p>You have no completed exams yet.</p></div> : <div className="history-list">{studentHistory.map((attempt:any)=><article className="history-card student-history-card" key={attempt.id}><div><span className="label">PAST EXAM</span><h2>{attempt.exam.title}</h2><p>{attempt.exam.subject} · Faculty: {attempt.exam.faculty.name}</p></div><div className="student-result-grid"><div><span>STATUS</span><b>{attempt.status}</b></div><div><span>SCORE</span><b>{attempt.score ?? 0}</b></div><div><span>SUBMITTED</span><b>{attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : '—'}</b></div></div></article>)}</div>}</section>}

      {view === 'student' && currentUser?.role === 'STUDENT' && <section className="page workspace"><div className="page-topbar"><button className="overview-back" type="button" onClick={() => navigate('home')}>← Back to Overview</button></div><div className="page-heading"><div><span className="eyebrow">STUDENT DASHBOARD</span><h1>Join your test.</h1><p>Welcome, {currentUser.name}. Enter the test URL and code shared by your faculty to continue.</p></div><button className="secondary" onClick={logout}>Sign out</button></div><div className="join-layout"><form className="join-card" onSubmit={handleJoin}><span className="label">PHASE 2 · TEST ACCESS</span><h2>Enter test details</h2><p>Use the exact URL and test code provided by your faculty.</p><label>Test URL<input required value={joinForm.testUrl} onChange={e=>setJoinForm({...joinForm,testUrl:e.target.value})} placeholder="http://localhost:5173/#/test/..." /></label><label>Test code<input required value={joinForm.joinCode} onChange={e=>setJoinForm({...joinForm,joinCode:e.target.value.toUpperCase()})} placeholder="e.g. 8F3A2C1D" /></label><button className="primary full" type="submit">Verify and join test →</button>{joinError && <div className="join-feedback error">{joinError}</div>}{joinMessage && <div className="join-feedback success">{joinMessage}</div>}</form><div className="info-card"><span className="label">STUDENT ACCESS</span><h2>Simple. Controlled. Traceable.</h2><div><b>01</b><span>Faculty creates and publishes the test.</span></div><div><b>02</b><span>You receive the test URL and unique code.</span></div><div><b>03</b><span>AnomalyDash verifies both before the exam session begins.</span></div></div></div></section>}

      <footer><span>AnomalyDash · CodeMatriX</span><span>Intelligent online examination platform</span></footer>
    </main>
  );
}
export default App;
