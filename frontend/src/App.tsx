import { FormEvent, useEffect, useState } from 'react';

type View = 'home' | 'login' | 'faculty' | 'student';
type Role = 'faculty' | 'student';

type Exam = {
  id: string;
  title: string;
  subject: string;
  durationMin: number;
  status: string;
  _count?: { questions: number };
};

const pipeline = [
  ['01', 'Online Examination', 'Questions, timer and secure answer collection'],
  ['02', 'Behaviour Signals', 'Focus, visibility, timing and paste metadata'],
  ['03', 'Anomaly Analysis', 'Evidence rules + statistical / ML analysis'],
  ['04', 'Faculty Intelligence', 'Live prioritization and explainable incidents'],
];

function getInitialView(): View {
  const hash = window.location.hash.replace('#/', '');
  return hash === 'faculty' || hash === 'student' || hash === 'login' ? hash : 'home';
}

function App() {
  const [view, setView] = useState<View>(getInitialView);
  const [dbStatus, setDbStatus] = useState('checking');
  const [examCount, setExamCount] = useState(0);
  const [exams, setExams] = useState<Exam[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', subject: '', durationMin: '60' });

  const navigate = (nextView: View) => {
    window.location.hash = nextView === 'home' ? '' : nextView;
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadData = async () => {
    try {
      const [health, examResponse] = await Promise.all([
        fetch('/api/db/health'),
        fetch('/api/exams'),
      ]);
      if (!health.ok || !examResponse.ok) throw new Error('API unavailable');
      const healthData = await health.json();
      const examData = await examResponse.json();
      setDbStatus(healthData.status === 'connected' ? 'connected' : 'offline');
      setExamCount(healthData.exams ?? 0);
      setExams(examData);
    } catch {
      setDbStatus('offline');
    }
  };

  useEffect(() => {
    void loadData();
    const onHashChange = () => setView(getInitialView());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const createExam = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!form.title.trim() || !form.subject.trim()) return;
    setCreating(true);
    try {
      const response = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          subject: form.subject.trim(),
          durationMin: Number(form.durationMin),
        }),
      });
      if (!response.ok) throw new Error('Could not create exam');
      setForm({ title: '', subject: '', durationMin: '60' });
      await loadData();
    } catch {
      setDbStatus('offline');
    } finally {
      setCreating(false);
    }
  };

  const chooseRole = (nextRole: Role) => { setRole(nextRole); navigate('login'); };

  const handleLogin = (event: FormEvent) => { event.preventDefault(); navigate(role); };

  return (
    <main className="app-shell">
      <nav className="topbar">
        <button className="brand brand-button" onClick={() => navigate('home')} aria-label="Go to AnomalyDash home">
          <div className="brand-mark">A</div>
          <div><strong>AnomalyDash</strong><span>by CodeMatriX</span></div>
        </button>
        <div className="nav-actions">
          <button className={`nav-link ${view === 'home' ? 'active' : ''}`} onClick={() => navigate('home')}>Overview</button>
          <button className={`nav-link ${view === 'faculty' ? 'active' : ''}`} onClick={() => navigate('faculty')}>Faculty</button>
          <button className={`nav-link ${view === 'student' ? 'active' : ''}`} onClick={() => navigate('student')}>Student</button>
          <span className="nav-status"><span className={`status-dot ${dbStatus === 'connected' ? 'db-online' : ''}`} />{statusLabel}</span>
        </div>
      </nav>

      {view === 'home' && (
        <>
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow">INTELLIGENT EXAMINATION MONITORING</div>
              <h1>Exams, made<br /><em>more intelligent.</em></h1>
              <p>AnomalyDash helps colleges conduct online examinations while turning unusual behaviour and answering patterns into explainable signals for faculty review.</p>
              <div className="hero-actions">
                <button className="primary" onClick={() => navigate('login')}>Sign in to AnomalyDash <span>→</span></button>
                <button className="secondary" onClick={() => chooseRole('student')}>Student access</button>
              </div>
              <div className="trust-line"><span>●</span> Faculty stays in control · Minimum-data monitoring · No webcam required</div>
            </div>
            <div className="hero-visual">
              <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
              <div className="signal-card">
                <div className="signal-top"><span className="label">ANOMALY INTELLIGENCE</span><span className="signal-live">SYSTEM READY</span></div>
                <div className="signal-score"><strong>86</strong><span>anomaly<br />score</span></div>
                <div className="signal-bars"><i /><i /><i /><i /><i /></div>
                <div className="signal-evidence"><span>Behaviour deviation</span><b>Detected</b></div>
                <div className="signal-evidence"><span>Answering pattern</span><b>Reviewed</b></div>
                <div className="signal-evidence"><span>Faculty decision</span><b>In control</b></div>
              </div>
              <div className="visual-caption">Behaviour + Answering Pattern → Anomaly Detection → Faculty Intelligence</div>
            </div>
          </section>
          <section className="overview-grid">
            <article className="overview-card featured"><span className="card-number">01</span><h2>Conduct exams normally.</h2><p>Questions, marks, duration and student responses live inside one structured examination workflow.</p></article>
            <article className="overview-card"><span className="card-number">02</span><h2>Observe meaningful signals.</h2><p>Focus changes, visibility events, timing shifts and paste metadata are captured without webcam or microphone surveillance.</p></article>
            <article className="overview-card"><span className="card-number">03</span><h2>Investigate, don't assume.</h2><p>Combined evidence highlights unusual sessions while keeping the final decision with faculty.</p></article>
          </section>
          <section className="access-section">
            <div><span className="eyebrow">SECURE ROLE-BASED ACCESS</span><h2>Who are you signing in as?</h2><p>Choose your role to enter the appropriate AnomalyDash workspace.</p></div>
            <div className="role-cards">
              <button className="role-card" onClick={() => chooseRole('faculty')}><span>FACULTY</span><strong>Manage examinations</strong><p>Create exams, monitor sessions and review anomaly evidence.</p><b>Faculty sign in →</b></button>
              <button className="role-card" onClick={() => chooseRole('student')}><span>STUDENT</span><strong>Take examinations</strong><p>Access assigned examinations and submit answers securely.</p><b>Student sign in →</b></button>
            </div>
          </section>
        </>
      )}

      {view === 'login' && (
        <section className="auth-page">
          <div className="auth-card">
            <span className="eyebrow">ANOMALYDASH ACCESS</span><h1>Sign in</h1>
            <p className="auth-subtitle">Continue as {role === 'faculty' ? 'Faculty' : 'Student'} to open your workspace.</p>
            <div className="role-switch"><button className={role === 'faculty' ? 'selected' : ''} onClick={() => setRole('faculty')}>Faculty</button><button className={role === 'student' ? 'selected' : ''} onClick={() => setRole('student')}>Student</button></div>
            <form onSubmit={handleLogin}>
              <label>Email address<input type="email" required placeholder={role === 'faculty' ? 'faculty@college.edu' : 'student@college.edu'} /></label>
              <label>Password<input type="password" required placeholder="Enter your password" /></label>
              <button className="primary full" type="submit">Continue as {role === 'faculty' ? 'Faculty' : 'Student'} <span>→</span></button>
            </form>
            <p className="auth-note">Authentication service is the next application layer. This role-based entry flow is ready for integration.</p>
            <button className="back-link" onClick={() => navigate('home')}>← Back to overview</button>
          </div>
        </section>
      )}

      {view === 'faculty' && (
        <section className="page workspace">
          <div className="page-heading">
            <div>
              <span className="eyebrow">FACULTY WORKSPACE</span>
              <h1>Exam management</h1>
              <p>Create and inspect persisted exams. Monitoring and anomaly controls will build on this workspace in later phases.</p>
            </div>
            <button className="secondary" onClick={() => navigate('home')}>← Overview</button>
          </div>

          <div className="workspace-grid">
            <form className="form-card" onSubmit={createExam}>
              <span className="label">CREATE EXAM</span>
              <h2>New examination</h2>
              <p>Creates a real Exam record through the backend and Prisma.</p>
              <label>Exam title<input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Data Structures — Mid Term" /></label>
              <label>Subject<input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} placeholder="e.g. Data Structures" /></label>
              <label>Duration (minutes)<input type="number" min="1" max="300" value={form.durationMin} onChange={e => setForm({...form, durationMin: e.target.value})} /></label>
              <button className="primary full" disabled={creating || dbStatus !== 'connected'}>{creating ? 'Saving to database…' : 'Create examination'}</button>
            </form>

            <div className="data-card">
              <div className="data-card-heading"><div><span className="label">PERSISTED EXAMS</span><h2>{examCount} records</h2></div><span className="connected-badge">{dbStatus === 'connected' ? 'CONNECTED' : 'OFFLINE'}</span></div>
              {exams.length === 0 ? <div className="empty-state">No exams found. Create the first examination.</div> : exams.map(exam => (
                <div className="exam-row" key={exam.id}>
                  <div><strong>{exam.title}</strong><span>{exam.subject} · {exam.durationMin} min · {exam._count?.questions ?? 0} questions</span></div>
                  <b>{exam.status}</b>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {view === 'student' && (
        <section className="page workspace">
          <div className="page-heading">
            <div>
              <span className="eyebrow">STUDENT PORTAL</span>
              <h1>Available examinations</h1>
              <p>Access examinations assigned to your student account.</p>
            </div>
            <button className="secondary" onClick={() => navigate('home')}>← Overview</button>
          </div>
          <div className="student-portal-card">
            <div className="portal-banner"><div><span className="label">READY</span><h2>Choose an examination</h2></div><span className="connected-badge">DATABASE {dbStatus.toUpperCase()}</span></div>
            {exams.map(exam => (
              <div className="student-exam" key={exam.id}>
                <div><span className="exam-status">{exam.status}</span><h3>{exam.title}</h3><p>{exam.subject} · {exam.durationMin} minutes · {exam._count?.questions ?? 0} questions</p></div>
                <button className="secondary" onClick={() => alert('Exam entry will be enabled in Phase 4 after authentication and exam-session setup.')}>Preview exam →</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer><span>AnomalyDash · CodeMatriX</span><span>Intelligent online examination platform</span></footer>
    </main>
  );
}

export default App;
