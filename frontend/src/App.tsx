import { FormEvent, useEffect, useState } from 'react';

type View = 'home' | 'faculty' | 'student';

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
  return hash === 'faculty' || hash === 'student' ? hash : 'home';
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

  const statusLabel = dbStatus === 'connected' ? 'Database connected' : dbStatus === 'checking' ? 'Checking database' : 'Database offline';

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
              <h1>See the exam.<br /><em>Understand the anomalies.</em></h1>
              <p>A professional online examination platform that turns meaningful examination behaviour and answering patterns into explainable signals for faculty review.</p>
              <div className="hero-actions">
                <button className="primary" onClick={() => navigate('faculty')}>Continue as Faculty <span>→</span></button>
                <button className="secondary" onClick={() => navigate('student')}>Preview Student Portal</button>
              </div>
              <div className="trust-line"><span>●</span> Faculty stays in control · Minimum-data monitoring · No webcam required</div>
            </div>

            <div className="hero-card">
              <div className="card-header">
                <div><span className="label">LIVE EXAM PREVIEW</span><h3>Computer Networks — Mid Term</h3></div>
                <span className="live-pill"><i /> LIVE</span>
              </div>
              <div className="mini-stats">
                <div><strong>42</strong><span>Students</span></div><div><strong>03</strong><span>Need attention</span></div><div><strong>00:48</strong><span>Remaining</span></div>
              </div>
              <div className="student-row danger"><div className="avatar">24</div><div className="student-info"><strong>Roll 24</strong><span>Multiple signals detected</span></div><b>86</b></div>
              <div className="student-row warning"><div className="avatar">17</div><div className="student-info"><strong>Roll 17</strong><span>Attention required</span></div><b>47</b></div>
              <div className="student-row normal"><div className="avatar">08</div><div className="student-info"><strong>Roll 08</strong><span>Behaviour within baseline</span></div><b>12</b></div>
              <div className="card-footer">Scores are decision-support signals, not proof of misconduct.</div>
            </div>
          </section>

          <section className="workspace">
            <div className="section-heading">
              <div><span className="eyebrow">PHASE 02 · DATABASE</span><h2>Persistent application data is now live.</h2></div>
              <span className="role-badge">{examCount} persisted exam{examCount === 1 ? '' : 's'}</span>
            </div>
            <div className="db-panel">
              <div>
                <span className="label">DATABASE STATUS</span>
                <h3>{dbStatus === 'connected' ? 'SQLite + Prisma connected' : 'Start the backend to connect'}</h3>
                <p>The application now has a real UI → API → database loop.</p>
              </div>
              <button className="secondary" onClick={() => navigate('faculty')}>Open Faculty Workspace →</button>
            </div>
            <div className="pipeline">
              {pipeline.map(([number, title, description]) => <article className="pipeline-card" key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}
            </div>
          </section>
        </>
      )}

      {view === 'faculty' && (
        <section className="page workspace">
          <div className="page-heading">
            <div>
              <span className="eyebrow">FACULTY WORKSPACE · PHASE 02</span>
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
              <span className="eyebrow">STUDENT PORTAL · PHASE 02</span>
              <h1>Available examinations</h1>
              <p>This preview reads real exam records from the database. Authentication and the examination experience are next-phase work.</p>
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

      <section className="principles">
        <div><span className="eyebrow">ENGINEERING PRINCIPLES</span><h2>Professional by design.<br />Responsible by default.</h2></div>
        <div className="principle-list">
          <div><strong>01</strong><span>Explainable anomalies</span></div><div><strong>02</strong><span>Faculty-in-the-loop decisions</span></div><div><strong>03</strong><span>Minimal examination data</span></div><div><strong>04</strong><span>Modular, testable architecture</span></div>
        </div>
      </section>

      <footer><span>AnomalyDash · CodeMatriX · Hackathon MVP</span><span>Phase 02 · Database v0.2</span></footer>
    </main>
  );
}

export default App;
