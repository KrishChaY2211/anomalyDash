# AnomalyDash

> **Intelligent online examination monitoring through behavioural anomaly detection**

AnomalyDash is a web-based online examination platform designed for colleges to conduct online exams while continuously analyzing relevant student examination behaviour and answering patterns.

Instead of relying on a single signal such as tab switching, AnomalyDash combines multiple behavioural and response signals to identify unusual patterns and presents them to faculty for review.

**AnomalyDash does not automatically declare a student guilty of cheating. It provides explainable evidence and anomaly scores so that faculty can make the final decision.**

## Problem

Traditional online examination platforms mainly focus on displaying questions, collecting answers, and calculating marks. Faculty have limited visibility into unusual behaviour such as repeated tab switching, focus loss, long absences, unusual response times, excessive answer changes, paste activity, and unusually similar answers.

AnomalyDash addresses this gap by turning examination activity into meaningful behavioural signals that faculty can inspect in real time.

## Solution

The core pipeline is:

~~~text
Online Examination
       ↓
Behaviour + Answer Collection
       ↓
Feature Extraction
       ↓
Rule / Statistical / ML Analysis
       ↓
0–100 Anomaly Score
       ↓
Live Faculty Monitoring
       ↓
Explainable Incident Timeline
       ↓
Faculty Decision
~~~

The system focuses on **combinations of signals**, rather than treating one event as proof of misconduct.

Example:

~~~text
Tab/Focus Loss
      +
Long Away Duration
      +
Paste Event
      +
Very Fast Answer
      +
High Answer Similarity
      ↓
Strong Anomaly Signal
~~~

## Key Features

### Online Examination

- Faculty can create examinations.
- Exams can contain MCQ and descriptive questions.
- Faculty can define duration, marks, instructions, and reference answers.
- Students enter an examination using an exam code.
- Students complete and submit the examination through the student portal.

### Behavioural Monitoring

The MVP monitors minimal examination-relevant behaviour:

- Tab/page visibility changes
- Browser focus loss and regain
- Away duration
- Repeated interruptions
- Network/session interruptions as contextual events
- Paste events inside supported answer fields

The system does **not** require webcam, microphone, continuous screen recording, or access to clipboard contents.

### Answering Pattern Analysis

AnomalyDash analyzes how students answer, including:

- Response time
- Response-time variation
- Answer changes
- Skipped questions
- Unusually fast responses
- Sudden changes in answering behaviour
- Paste activity

### Answer Similarity

For descriptive questions, AnomalyDash can compare:

1. **Student answer → Faculty reference answer**
2. **Student answer → Other student answers**

High similarity is treated as a signal for review, not automatic proof of cheating.

### Anomaly Detection

The system combines direct behavioural evidence with statistical and/or unsupervised ML analysis.

Candidate anomaly combinations include:

- Repeated focus loss + significant away time
- Focus loss + long absence + unusual response time
- Focus loss + paste + rapid submission
- Focus loss + paste + high answer similarity
- High student-to-student answer similarity + similar timing
- Multiple behavioural signals + significant deviation from baseline

The exact anomaly model and scoring implementation will be finalized during system design.

### 0–100 Anomaly Score

Each student receives an anomaly/risk score from **0 to 100**.

Default levels:

| Score | Status |
|---:|---|
| 0–29 | 🟢 Normal |
| 30–59 | 🟡 Attention |
| 60–79 | 🟠 Suspicious |
| 80–100 | 🔴 High Risk |

Faculty can modify the score thresholds before an examination.

The score represents **unusual behaviour**, not a probability or automatic verdict of cheating.

### Live Faculty Monitoring

Faculty receive a live view of active students.

Anomalous students are highlighted and prioritized near the top. Faculty can open a student's profile to inspect the evidence behind the score.

### Explainable Incident Timeline

A student profile can show a sequence such as:

~~~text
10:32:14  Focus lost
10:32:14  Tab hidden

10:32:57  Focus regained
          Away: 43 seconds

10:33:01  Paste detected

10:33:05  Answer submitted
          Response time: 4 seconds

10:33:06  High answer similarity
~~~

This helps faculty understand **why** a student was flagged instead of simply displaying an unexplained score.

### Faculty Review

Faculty remain in control. Possible actions include:

- Review incident
- Dismiss incident
- Mark student as suspicious
- Terminate a student's examination

The system does not automatically terminate or punish a student based solely on anomaly detection.

## Student Experience

Before starting an examination, students are informed not to open or close other tabs/windows while using the examination portal.

During the examination, the student sees a normal examination interface and is **not shown internal anomaly scores, detection rules, or suspicion levels**.

## Faculty Experience

Typical workflow:

~~~text
Faculty Login
     ↓
Create Examination
     ↓
Add Questions + Reference Answers
     ↓
Configure Duration / Thresholds
     ↓
Generate Examination Code
     ↓
Share Code With Students
     ↓
Start Monitoring
     ↓
Live Student List
     ↓
Anomalous Students Prioritized
     ↓
Open Student Profile
     ↓
Review Incident Timeline
     ↓
Faculty Decision
~~~

## Hackathon Demonstration

AnomalyDash is designed to be demonstrated with the three-person CodeMatriX team.

### Faculty

One team member logs into the faculty account and:

1. Creates a test.
2. Adds questions and reference answers.
3. Sets the exam duration.
4. Configures anomaly thresholds.
5. Publishes the test.
6. Shares the generated exam code.

### Genuine Student

A second team member logs into a student account and enters the exam code. They answer normally.

Expected result:

~~~text
Student A
Status: Normal
Anomaly Score: Low
~~~

### Simulated Suspicious Student

The third team member enters the same exam.

During a descriptive question, they simulate suspicious behaviour:

~~~text
Question displayed
      ↓
Leaves examination tab
      ↓
Uses an external AI/search source
      ↓
Returns to examination
      ↓
Pastes an answer
      ↓
Submits rapidly
~~~

The faculty dashboard receives these events and updates the student's anomaly score.

Example:

~~~text
Student B
Status: High Risk
Anomaly Score: 86 / 100
~~~

The faculty then opens the student's profile and sees the contributing evidence.

**Core demonstration message:**

> Behaviour + Answering Patterns → Anomaly Detection → Explainable Evidence → Faculty Decision

## Privacy and Responsible Monitoring

AnomalyDash follows a **minimum-data monitoring** approach.

### The MVP does collect

- Examination behaviour events
- Timing information
- Answer changes
- Paste-event metadata
- Relevant answer similarity signals

### The MVP does not require

- Webcam video
- Microphone audio
- Continuous screen recording
- Browsing history
- Personal files
- Clipboard contents

A network interruption is treated as contextual information and is not, by itself, considered suspicious.

## Why AnomalyDash?

Traditional online examination systems answer:

> **"What did the student submit?"**

AnomalyDash additionally asks:

> **"What unusual pattern occurred while the student was taking the examination?"**

Its core differentiator is the combination of:

**Behaviour Monitoring + Answering Patterns + Similarity Analysis + Statistical/ML Anomaly Detection + Real-Time Faculty Intelligence**

## MVP Scope

### Must Have

- Faculty authentication
- Student authentication
- Examination creation
- Examination code
- MCQ questions
- Descriptive questions
- Reference answers
- Student examination interface
- Timer
- Behaviour monitoring
- Focus/tab event collection
- Away-duration tracking
- Answer timing
- Answer changes
- Paste-event detection
- Answer similarity
- Student-to-student similarity where feasible
- Statistical/ML anomaly detection
- 0–100 anomaly score
- Configurable faculty thresholds
- Incident generation
- Live faculty monitoring
- Anomalous-student prioritization
- Student anomaly profile
- Faculty review
- Faculty-controlled termination

### Not Required for MVP

- Webcam proctoring
- Microphone monitoring
- Continuous screen recording
- Mandatory screen sharing
- Automatic punishment
- Guaranteed AI-content detection
- Complex deep-learning systems

## Project Status

🚧 **Under development**

Requirements have been documented in the project SRS. The next stage is system design and implementation.

See: docs/SRS.md

## Repository Structure

~~~text
anomalyDash/
├── README.md
├── .gitignore
├── docs/
│   └── SRS.md
├── frontend/
│   └── .gitkeep
└── backend/
    └── .gitkeep
~~~

- frontend/ — Student and faculty web interfaces
- backend/ — Server-side application, APIs, event processing, and anomaly services
- docs/ — Project documentation and requirements

## Engineering Principles

The project is being developed as a proper software engineering project rather than only as a hackathon demo.

- Requirements before implementation
- Modular architecture
- Explainable anomaly detection
- Minimum necessary data collection
- Faculty-in-the-loop decision making
- Secure role-based access
- Testable components
- Clear documentation
- Maintainable code

## Team

**CodeMatriX**

Building **AnomalyDash** as a 24-hour hackathon project.

## License

License to be decided.
