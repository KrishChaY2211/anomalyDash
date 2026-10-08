import { useEffect, useState } from 'react';

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

function App() {
  const [role, setRole] = useState<Role>('faculty');
  const [dbStatus, setDbStatus] = useState('checking');
  const [examCount, setExamCount] = useState(0);
  const [exams, setExams] = useState<Exam[]>([]);
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    try {
      const [health, examResponse] = await Promise.all([fetch('/api/db/health'), fetch('/api/exams')]);
      const healthData = await health.json();
      const examData = await examResponse.json();
      setDbStatus(healthData.status === 'connected' ? 'connected' : 'offline');
      setExamCount(healthData.exams ?? 0);
      setExams(examData);
    } catch {
      setDbStatus('offline');
    }
  };

  useEffect(() => { void loadData(); }, []);

  const createExam = async () => {
    setCreating(true);
    try {
      await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Database Integration Demo', subject: 'Software Engineering', durationMin: 45 }),
      });
      await loadData();
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="app-shell">
      <nav className="topbar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div><strong>AnomalyDash</strong><span>by CodeMatriX</span></div>
        </div>
        <div className="nav-status">
          <span className={`status-dot ${dbStatus === 'connected' ? 'db-online' : ''}`} />
          {dbStatus === 'connected' ? 'Database connected' : 'Database checking'}
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">INTELLIGENT EXAMINATION MONITORING</div>
          <h1>See the exam.<br /><em>Understand the anomalies.</em></h1>
          <p>A professional online examination platform that turns meaningful examination behaviour and answering patterns into explainable signals for faculty review.</p>
          <div className="hero-actions">
            <button className="primary" onClick={() => setRole('faculty')}>Continue as Faculty <span>→</span></button>
            <button className="secondary" onClick={() => setRole('student')}>Preview Student Portal</button>
          </div>
          <div className="trust-line"><span>●</span> Faculty stays in control · Minimum-data monitoring · No webcam required</div>
        </div>

        <div className="hero-card">
          <div className="card-header">
            <div><span className="label">LIVE EXAM</span><h3>Computer Networks — Mid Term</h3></div>
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
          <span className="role-badge">Previewing: {role === 'faculty' ? 'Faculty' : 'Student'}</span>
        </div>

        <div className="db-panel">
          <div>
            <span className="label">DATABASE STATUS</span>
            <h3>{dbStatus === 'connected' ? 'SQLite + Prisma connected' : 'Start the backend to connect'}</h3>
            <p>{examCount} exam record{examCount === 1 ? '' : 's'} persisted in the local database.</p>
          </div>
          <button className="secondary" onClick={createExam} disabled={creating || dbStatus !== 'connected'}>
            {creating ? 'Saving…' : 'Create DB Test Exam'}
          </button>
        </div>

        <div className="exam-list">
          <div className="list-heading"><span>EXAMS FROM DATABASE</span><span>{exams.length} records</span></div>
          {exams.map((exam) => (
            <div className="exam-row" key={exam.id}>
              <div><strong>{exam.title}</strong><span>{exam.subject} · {exam.durationMin} min · {exam._count?.questions ?? 0} questions</span></div>
              <b>{exam.status}</b>
            </div>
          ))}
        </div>

        <div className="pipeline">
          {pipeline.map(([number, title, description]) => <article className="pipeline-card" key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>

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
