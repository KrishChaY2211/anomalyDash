import { FormEvent, useEffect, useState } from 'react';

type View = 'home' | 'login' | 'faculty' | 'student' | 'exam' | 'faculty-history' | 'student-history';
type Role = 'faculty' | 'student';
type AuthMode = 'signin' | 'signup';

type User = { id: string; name: string; email: string; role: 'FACULTY' | 'STUDENT'; rollNumber?: string | null };
type Exam = {
  id: string;
  title: string;
  subject: string;
  durationMin: number;
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
  if (hash === 'student-history') return 'student-history';
  return 'home';
}

function App() {
  const [view, setView] = useState<View>(getInitialView);
  const [role, setRole] = useState<Role>('student');
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [dbStatus, setDbStatus] = useState('checking');
  const [exams, setExams] = useState<Exam[]>([]);
  const [form, setForm] = useState({ title: '', subject: '', durationMin: '60' });
  const [authForm, setAuthForm] = useState({ name: '', rollNumber: '', email: '', password: '', confirmPassword: '' });
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem('anomalydash_user') || 'null'); } catch { return null; }
  });
  const [creating, setCreating] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [questionForm, setQuestionForm] = useState({ type: 'MCQ', prompt: '', marks: '1', options: '', answerKey: '' });
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [joinForm, setJoinForm] = useState({ testUrl: '', joinCode: '' });
  const [joinMessage, setJoinMessage] = useState('');
  const [joinError, setJoinError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [endingExam, setEndingExam] = useState(false);
  const [activeAttempt, setActiveAttempt] = useState<any | null>(null);
  const [activeExam, setActiveExam] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [examLoading, setExamLoading] = useState(false);
  const [examMessage, setExamMessage] = useState('');
  const [examError, setExamError] = useState('');
  const [facultyHistory, setFacultyHistory] = useState<any[]>([]);
  const [studentHistory, setStudentHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const statusLabel = dbStatus === 'connected' ? 'Database connected' : dbStatus === 'checking' ? 'Checking database' : 'Database offline';

  const navigate = (nextView: View) => {
    window.location.hash = nextView === 'home' ? '' : nextView;
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openAuth = (mode: AuthMode) => { setAuthMode(mode); navigate('login'); };

  const loadData = async () => {
    try {
      const response = await fetch('/api/exams');
      if (!response.ok) throw new Error();
      const data = await response.json();
      setExams(data);
      setDbStatus('connected');
    } catch { setDbStatus('offline'); }
  };

  useEffect(() => {
    void loadData();
    const onHashChange = () => setView(getInitialView());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [currentUser?.id, currentUser?.role]);

  const createExam = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!form.title.trim() || !form.subject.trim() || !currentUser) return;
    setCreating(true);
    try {
      const response = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, durationMin: Number(form.durationMin), facultyId: currentUser.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not create test');
      setForm({ title: '', subject: '', durationMin: '60' });
      setSelectedExam(data);
      await loadData();
    } catch (error) { setDbStatus('offline'); alert(error instanceof Error ? error.message : 'Could not create test'); }
    finally { setCreating(false); }
  };

  const addQuestion = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedExam || !questionForm.prompt.trim()) return;
    setAddingQuestion(true);
    try {
      const response = await fetch(`/api/exams/${selectedExam.id}/questions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...questionForm, marks: Number(questionForm.marks) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not add question');
      setQuestionForm({ type: 'MCQ', prompt: '', marks: '1', options: '', answerKey: '' });
      setSelectedExam({ ...selectedExam, _count: { questions: (selectedExam._count?.questions || 0) + 1 } });
      await loadData();
    } catch (error) { alert(error instanceof Error ? error.message : 'Could not add question'); }
    finally { setAddingQuestion(false); }
  };

  const endLiveSession = async () => {
    if (!selectedExam || selectedExam.status !== 'LIVE' || !currentUser) return;
    if (!window.confirm('End this live session? Students who have not started will be blocked, and active attempts will be closed.')) return;
    setEndingExam(true);
    try {
      const response = await fetch(`/api/exams/${selectedExam.id}/end`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facultyId: currentUser.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not end live session');
      setSelectedExam({ ...selectedExam, status: 'COMPLETED' });
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not end live session');
    } finally {
      setEndingExam(false);
    }
  };

  const publishExam = async () => {
    if (!selectedExam) return;
    setPublishing(true);
    try {
      const response = await fetch(`/api/exams/${selectedExam.id}/publish`, { method: 'PATCH' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not publish test');
      setSelectedExam({ ...selectedExam, status: 'LIVE' });
      await loadData();
    } catch (error) { alert(error instanceof Error ? error.message : 'Could not publish test'); }
    finally { setPublishing(false); }
  };

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();
    setJoinError(''); setJoinMessage('');
    try {
      const response = await fetch('/api/exams/join', {
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
      const response = await fetch(authMode === 'signup' ? '/api/auth/signup' : '/api/auth/signin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: authForm.name, rollNumber: authForm.rollNumber, email: authForm.email, password: authForm.password, role: role.toUpperCase() })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Authentication failed (${response.status})`);
      if (!data.user) throw new Error('Authentication succeeded but no user session was returned.');
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
      const response = await fetch(`/api/exams/${examId}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: currentUser.id, joinCode }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not start exam');
      setActiveAttempt(data.attempt);
      setActiveExam(data.exam);
      setAnswers(Object.fromEntries((data.attempt.answers || []).map((a: any) => [a.questionId, a.answer])));
      setRemainingSeconds(Math.max(0, Math.floor((new Date(data.attempt.expiresAt).getTime() - Date.now()) / 1000)));
      // Enter the exam view directly without triggering the hashchange listener.
      window.history.replaceState(null, '', '#/exam');
      setView('exam');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) { setExamError(error instanceof Error ? error.message : 'Could not start exam'); }
    finally { setExamLoading(false); }
  };

  const saveAnswer = async (questionId: string, answer: string) => {
    if (!activeAttempt) return;
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    try {
      const response = await fetch(`/api/attempts/${activeAttempt.id}/answers`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId, answer }) });
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
      const response = await fetch(`/api/attempts/${activeAttempt.id}/submit`, { method: 'POST' });
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

  const loadFacultyHistory = async () => {
    if (!currentUser || currentUser.role !== 'FACULTY') return;
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/faculty/${currentUser.id}/history`);
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
      const response = await fetch(`/api/students/${currentUser.id}/history`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load history');
      setStudentHistory(data);
    } catch (error) { alert(error instanceof Error ? error.message : 'Could not load history'); }
    finally { setHistoryLoading(false); }
  };

  const logout = () => { localStorage.removeItem('anomalydash_user'); setCurrentUser(null); navigate('home'); };

  return (
    <main className="app-shell">
      <nav className="topbar">
        <button className="brand brand-button" onClick={() => navigate('home')}><div className="brand-mark">A</div><div><strong>AnomalyDash</strong><span>by CodeMatriX</span></div></button>
        <div className="nav-actions">
          <button className={`nav-link ${view === 'home' ? 'active' : ''}`} onClick={() => navigate('home')}>Overview</button>
          {currentUser?.role === 'FACULTY' && <><button className={`nav-link ${view === 'faculty' ? 'active' : ''}`} onClick={() => navigate('faculty')}>Faculty</button><button className={`nav-link ${view === 'faculty-history' ? 'active' : ''}`} onClick={() => { navigate('faculty-history'); void loadFacultyHistory(); }}>History</button></>}
          {currentUser?.role === 'STUDENT' && <><button className={`nav-link ${view === 'student' ? 'active' : ''}`} onClick={() => navigate('student')}>Student</button><button className={`nav-link ${view === 'student-history' ? 'active' : ''}`} onClick={() => { navigate('student-history'); void loadStudentHistory(); }}>Past Exams</button></>}
          {currentUser && <button className="nav-link" onClick={logout}>Sign out</button>}
          <span className="nav-status"><span className={`status-dot ${dbStatus === 'connected' ? 'db-online' : ''}`} />{statusLabel}</span>
        </div>
      </nav>

      {view === 'home' && <><section className="hero"><div className="hero-copy"><div className="eyebrow">INTELLIGENT EXAMINATION MONITORING</div><h1>Exams, made<br /><em>more intelligent.</em></h1><p>AnomalyDash helps colleges conduct online examinations while turning unusual behaviour and answering patterns into explainable signals for faculty review.</p><div className="hero-actions"><button className="primary" onClick={() => currentUser ? navigate(currentUser.role === 'FACULTY' ? 'faculty' : 'student') : openAuth('signin')}>{currentUser ? 'Open Dashboard' : 'Get Started'} <span>→</span></button></div><div className="trust-line"><span>●</span> Faculty stays in control · Minimum-data monitoring · No webcam required</div></div><div className="hero-visual"><div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" /><div className="signal-card"><div className="signal-top"><span className="label">ANOMALY INTELLIGENCE</span><span className="signal-live">SYSTEM READY</span></div><div className="signal-score"><strong>86</strong><span>anomaly<br />score</span></div><div className="signal-bars"><i /><i /><i /><i /><i /></div><div className="signal-evidence"><span>Behaviour deviation</span><b>Detected</b></div><div className="signal-evidence"><span>Answering pattern</span><b>Reviewed</b></div><div className="signal-evidence"><span>Faculty decision</span><b>In control</b></div></div><div className="visual-caption">Behaviour + Answering Pattern → Anomaly Detection → Faculty Intelligence</div></div></section><section className="overview-grid"><article className="overview-card featured"><span className="card-number">01</span><h2>Conduct exams normally.</h2><p>Questions, marks, duration and student responses live inside one structured examination workflow.</p></article><article className="overview-card"><span className="card-number">02</span><h2>Observe meaningful signals.</h2><p>Focus changes, visibility events, timing shifts and paste metadata are captured without webcam or microphone surveillance.</p></article><article className="overview-card"><span className="card-number">03</span><h2>Investigate, don't assume.</h2><p>Combined evidence highlights unusual sessions while keeping the final decision with faculty.</p></article></section></>}

      {view === 'login' && <section className="auth-page"><div className="auth-card"><span className="eyebrow">ANOMALYDASH ACCESS</span><h1>{authMode === 'signin' ? 'Welcome back' : 'Create your account'}</h1><p className="auth-subtitle">{authMode === 'signin' ? 'Sign in to continue to your AnomalyDash workspace.' : 'Create your AnomalyDash account to get started.'}</p><div className="role-switch"><button className={authMode === 'signin' ? 'selected' : ''} onClick={() => setAuthMode('signin')}>Sign In</button><button className={authMode === 'signup' ? 'selected' : ''} onClick={() => setAuthMode('signup')}>Sign Up</button></div><div className="role-switch"><button className={role === 'faculty' ? 'selected' : ''} onClick={() => setRole('faculty')}>Faculty</button><button className={role === 'student' ? 'selected' : ''} onClick={() => setRole('student')}>Student</button></div><form onSubmit={handleAuth}>{authMode === 'signup' && <label>Full name<input required value={authForm.name} onChange={e => setAuthForm({...authForm,name:e.target.value})} placeholder="Enter your full name" /></label>}{role === 'student' && <label>Roll number<input required value={authForm.rollNumber} onChange={e => setAuthForm({...authForm,rollNumber:e.target.value})} placeholder="Enter your college roll number" /></label>}<label>Email address<input type="email" required value={authForm.email} onChange={e => setAuthForm({...authForm,email:e.target.value})} placeholder={role === 'faculty' ? 'faculty@college.edu' : 'student@college.edu'} /></label><label>Password<input type="password" required minLength={6} value={authForm.password} onChange={e => setAuthForm({...authForm,password:e.target.value})} placeholder="Enter your password" /></label>{authMode === 'signup' && <label>Confirm password<input type="password" required minLength={6} value={authForm.confirmPassword} onChange={e => setAuthForm({...authForm,confirmPassword:e.target.value})} placeholder="Confirm your password" /></label>}<button className="primary full" type="submit" disabled={authLoading}>{authLoading ? 'Authenticating…' : authMode === 'signin' ? 'Sign in' : 'Create account'} as {role === 'faculty' ? 'Faculty' : 'Student'} <span>→</span></button></form>{authError && <div className="auth-error" role="alert"><strong>Authentication failed</strong><span>{authError}</span></div>}{authSuccess && <div className="auth-success" role="status">{authSuccess}</div>}<p className="auth-note">Your credentials are verified against the AnomalyDash database before entering your role workspace.</p><button className="back-link" onClick={() => navigate('home')}>← Back to overview</button></div></section>}

      {view === 'faculty' && currentUser?.role === 'FACULTY' && <section className="page workspace"><div className="page-heading"><div><span className="eyebrow">FACULTY DASHBOARD</span><h1>Create and publish tests.</h1><p>Welcome, {currentUser.name}. Build a test, add questions, then publish it to generate a student-ready join flow.</p></div><button className="secondary" onClick={logout}>Sign out</button></div><div className="workspace-grid"><form className="form-card" onSubmit={createExam}><span className="label">PHASE 3 · TEST BUILDER</span><h2>New test</h2><p>Create the examination record first. A unique test code and URL are generated automatically.</p><label>Test name<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Data Structures Mid Term" /></label><label>Subject<input required value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="e.g. Data Structures" /></label><label>Duration (minutes)<input type="number" min="1" max="300" required value={form.durationMin} onChange={e=>setForm({...form,durationMin:e.target.value})} /></label><button className="primary full" disabled={creating || dbStatus !== 'connected'}>{creating ? 'Creating test…' : 'Create new test →'}</button></form><div className="data-card"><div className="data-card-heading"><div><span className="label">MY TESTS</span><h2>{exams.filter(e=>e.status !== 'COMPLETED').length} records</h2></div><span className="connected-badge">{dbStatus === 'connected' ? 'CONNECTED' : 'OFFLINE'}</span></div>{exams.filter(e=>!currentUser || true).map(exam=><div className={`exam-row ${selectedExam?.id === exam.id ? 'selected-row' : ''}`} key={exam.id} onClick={()=>setSelectedExam(exam)}><div><strong>{exam.title}</strong><span>{exam.subject} · {exam.durationMin} min · {exam._count?.questions ?? 0} questions</span>{exam.joinCode && <small>Code: <b>{exam.joinCode}</b></small>}</div><b>{exam.status}</b></div>)}</div></div>{selectedExam && <section className="builder-panel"><div className="builder-head"><div><span className="label">TEST CONFIGURATION</span><h2>{selectedExam.title}</h2><p>{selectedExam.status === 'LIVE' ? 'This test is live. Students can join using the code and URL below.' : 'Add at least one question, then publish this test.'}</p></div><div className="test-credentials"><span>TEST CODE <b>{selectedExam.joinCode}</b></span><span>TEST URL <b>{selectedExam.accessUrl}</b></span></div></div><form className="question-form" onSubmit={addQuestion}><label>Question type<select value={questionForm.type} onChange={e=>setQuestionForm({...questionForm,type:e.target.value})}><option value="MCQ">Multiple choice</option><option value="DESCRIPTIVE">Descriptive</option></select></label><label>Question<input required value={questionForm.prompt} onChange={e=>setQuestionForm({...questionForm,prompt:e.target.value})} placeholder="Enter the question" /></label><label>Marks<input type="number" min="1" required value={questionForm.marks} onChange={e=>setQuestionForm({...questionForm,marks:e.target.value})} /></label>{questionForm.type === 'MCQ' && <><label>Options<input value={questionForm.options} onChange={e=>setQuestionForm({...questionForm,options:e.target.value})} placeholder="Option A | Option B | Option C | Option D" /></label><label>Answer key<input value={questionForm.answerKey} onChange={e=>setQuestionForm({...questionForm,answerKey:e.target.value})} placeholder="e.g. A" /></label></>}<button className="primary" disabled={addingQuestion}>{addingQuestion ? 'Adding…' : 'Add question'}</button></form><div className="builder-footer"><span>{selectedExam._count?.questions ?? 0} question(s) added</span><button className="primary" disabled={publishing || endingExam || selectedExam.status === 'LIVE' || selectedExam.status === 'COMPLETED'} onClick={publishExam}>{selectedExam.status === 'LIVE' ? 'Test published ✓' : publishing ? 'Publishing…' : 'Publish test →'}</button>
{selectedExam.status === 'LIVE' && <button type="button" className="secondary danger-action" disabled={endingExam} onClick={()=>void endLiveSession()}>{endingExam ? 'Ending session…' : 'End live session'}</button>}</div></section>}</section>}

      {view === 'faculty-history' && currentUser?.role === 'FACULTY' && <section className="page workspace"><div className="page-heading"><div><span className="eyebrow">FACULTY HISTORY</span><h1>Past examinations.</h1><p>Review completed tests, participating students, scores and recorded anomaly signals.</p></div><button className="secondary" onClick={()=>void loadFacultyHistory()}>Refresh history</button></div>{historyLoading ? <div className="data-card"><p>Loading examination history…</p></div> : facultyHistory.length === 0 ? <div className="data-card"><p>No completed examinations yet.</p></div> : <div className="history-list">{facultyHistory.map((exam:any)=><article className="history-card" key={exam.id}><div className="history-card-head"><div><span className="label">COMPLETED TEST</span><h2>{exam.title}</h2><p>{exam.subject} · {exam.durationMin} min · {exam.attempts.length} student attempt(s)</p></div><span className="history-status">COMPLETED</span></div><div className="history-attempts">{exam.attempts.length === 0 ? <p>No student attempts recorded.</p> : exam.attempts.map((attempt:any)=><div className="history-attempt" key={attempt.id}><div><strong>{attempt.student.name}</strong><span>{attempt.student.rollNumber || attempt.student.email}</span></div><div><b>{attempt.score ?? 0} marks</b><span>{attempt.status}</span></div><div><b className={attempt.anomalyLevel === 'HIGH' ? 'anomaly-high' : attempt.anomalyLevel === 'MEDIUM' ? 'anomaly-medium' : 'anomaly-clear'}>{attempt.anomalyLevel} · {attempt.anomalyScore}</b><span>Anomaly score</span></div></div>)}</div></article>)}</div>}</section>}

      {view === 'exam' && currentUser?.role === 'STUDENT' && activeExam && activeAttempt && <section className="page workspace exam-page"><div className="page-heading"><div><span className="eyebrow">LIVE EXAMINATION</span><h1>{activeExam.title}</h1><p>{activeExam.subject} · {activeExam.questions.length} questions · {currentUser.name}</p></div><div className="exam-timer">{Math.floor(remainingSeconds / 60).toString().padStart(2,'0')}:{(remainingSeconds % 60).toString().padStart(2,'0')}</div></div>{examError && <div className="join-feedback error">{examError}</div>}{examMessage ? <div className="join-feedback success">{examMessage}<button className="secondary" onClick={()=>navigate('student')}>Return to dashboard</button></div> : <><div className="exam-questions">{activeExam.questions.map((q:any,index:number)=><article className="question-card" key={q.id}><div className="question-meta"><span>QUESTION {index+1}</span><b>{q.marks} mark{q.marks === 1 ? '' : 's'}</b></div><h2>{q.prompt}</h2>{q.type === 'MCQ' ? <div className="option-list">{String(q.options || '').split('|').map((option:string,i:number)=>{const value=option.trim(); return value ? <label className={answers[q.id] === value ? 'option selected' : 'option'} key={i}><input type="radio" name={q.id} checked={answers[q.id] === value} onChange={()=>void saveAnswer(q.id,value)} />{value}</label> : null;})}</div> : <textarea className="answer-box" value={answers[q.id] || ''} onChange={e=>void saveAnswer(q.id,e.target.value)} placeholder="Type your answer here..." />}</article>)}</div><div className="exam-submit"><span>Answers are saved automatically.</span><button className="primary" disabled={examLoading} onClick={()=>void submitExam()}>{examLoading ? 'Submitting…' : 'Submit exam →'}</button></div></>}</section>}

      {view === 'student-history' && currentUser?.role === 'STUDENT' && <section className="page workspace"><div className="page-heading"><div><span className="eyebrow">PAST EXAMS</span><h1>Your examination history.</h1><p>Review the tests you have completed and the results recorded for each attempt.</p></div><button className="secondary" onClick={()=>void loadStudentHistory()}>Refresh history</button></div>{historyLoading ? <div className="data-card"><p>Loading past exams…</p></div> : studentHistory.length === 0 ? <div className="data-card"><p>You have no completed exams yet.</p></div> : <div className="history-list">{studentHistory.map((attempt:any)=><article className="history-card student-history-card" key={attempt.id}><div><span className="label">PAST EXAM</span><h2>{attempt.exam.title}</h2><p>{attempt.exam.subject} · Faculty: {attempt.exam.faculty.name}</p></div><div className="student-result-grid"><div><span>STATUS</span><b>{attempt.status}</b></div><div><span>SCORE</span><b>{attempt.score ?? 0}</b></div><div><span>ANOMALY</span><b className={attempt.anomalyLevel === 'HIGH' ? 'anomaly-high' : attempt.anomalyLevel === 'MEDIUM' ? 'anomaly-medium' : 'anomaly-clear'}>{attempt.anomalyLevel}</b></div><div><span>SUBMITTED</span><b>{attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : '—'}</b></div></div></article>)}</div>}</section>}

      {view === 'student' && currentUser?.role === 'STUDENT' && <section className="page workspace"><div className="page-heading"><div><span className="eyebrow">STUDENT DASHBOARD</span><h1>Join your test.</h1><p>Welcome, {currentUser.name}. Enter the test URL and code shared by your faculty to continue.</p></div><button className="secondary" onClick={logout}>Sign out</button></div><div className="join-layout"><form className="join-card" onSubmit={handleJoin}><span className="label">PHASE 2 · TEST ACCESS</span><h2>Enter test details</h2><p>Use the exact URL and test code provided by your faculty.</p><label>Test URL<input required value={joinForm.testUrl} onChange={e=>setJoinForm({...joinForm,testUrl:e.target.value})} placeholder="http://localhost:5173/#/test/..." /></label><label>Test code<input required value={joinForm.joinCode} onChange={e=>setJoinForm({...joinForm,joinCode:e.target.value.toUpperCase()})} placeholder="e.g. 8F3A2C1D" /></label><button className="primary full" type="submit">Verify and join test →</button>{joinError && <div className="join-feedback error">{joinError}</div>}{joinMessage && <div className="join-feedback success">{joinMessage}</div>}</form><div className="info-card"><span className="label">STUDENT ACCESS</span><h2>Simple. Controlled. Traceable.</h2><div><b>01</b><span>Faculty creates and publishes the test.</span></div><div><b>02</b><span>You receive the test URL and unique code.</span></div><div><b>03</b><span>AnomalyDash verifies both before the exam session begins.</span></div></div></div></section>}

      <footer><span>AnomalyDash · CodeMatriX</span><span>Intelligent online examination platform</span></footer>
    </main>
  );
}
export default App;
