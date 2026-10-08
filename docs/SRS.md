# AnomalyDash — Software Requirements Specification (SRS)

**Version:** 0.1  
**Status:** Draft / Requirements Baseline  
**Team:** CodeMatriX  
**Project:** AnomalyDash  
**Platform:** Web-based Online Examination System

---

## 1. Introduction

### 1.1 Purpose

AnomalyDash is a web-based online examination platform designed for colleges to conduct online examinations while continuously monitoring relevant student examination behaviour.

The system analyzes behavioural events and answering patterns to identify unusual combinations of activity that may require faculty attention.

AnomalyDash is a **decision-support system**, not an automatic cheating detector. It identifies anomalies and presents supporting evidence to faculty, while the final decision remains with the faculty member.

### 1.2 Intended Audience

- CodeMatriX development team
- Faculty and examination administrators
- System designers and testers
- Hackathon evaluators
- Future developers maintaining the system

### 1.3 Scope Summary

The system provides:

- Faculty examination creation
- Student examination interface
- MCQ and descriptive questions
- Examination timer
- Behavioural event monitoring
- Answering-pattern analysis
- Semantic answer similarity analysis
- Statistical/ML-based anomaly detection
- Combined anomaly scoring
- Real-time faculty monitoring
- Student anomaly history and incident details
- Faculty-controlled review and action

---

## 2. Problem Statement

Traditional online examination systems primarily focus on delivering questions, collecting answers, and calculating marks.

They provide limited visibility into unusual examination behaviour such as:

- repeated tab switching,
- repeated loss of browser focus,
- unusually long periods away from the examination,
- abnormal response-time patterns,
- excessive answer changes,
- unusual combinations of multiple behaviours.

When many students take an examination simultaneously, faculty cannot manually observe and analyze these patterns for every student.

AnomalyDash addresses this problem by collecting minimal relevant examination events, analyzing answering behaviour, detecting unusual patterns, and presenting potentially significant incidents to faculty in real time.

---

## 3. Objectives

1. Provide a functional online examination platform.
2. Monitor relevant student examination behaviour without intrusive surveillance.
3. Analyze student answering patterns.
4. Compare descriptive answers with faculty-provided reference answers.
5. Detect unusual combinations of behavioural and answering signals.
6. Use statistical and/or unsupervised machine-learning techniques to identify anomalies.
7. Generate an explainable anomaly score for each student.
8. Provide faculty with a live monitoring interface.
9. Allow faculty to inspect the evidence behind an anomaly.
10. Keep the final decision regarding suspected misconduct under faculty control.
11. Minimize unnecessary collection of student data.
12. Provide an MVP that can realistically be demonstrated within the hackathon timeframe.

---

## 4. System Scope

### 4.1 In Scope

- Student authentication/access
- Faculty authentication/access
- Examination creation
- MCQ questions
- Descriptive/typed questions
- Faculty reference answers
- Examination timer
- Student answer submission
- Behavioural event collection
- Tab visibility monitoring
- Browser focus monitoring
- Away-duration measurement
- Network/session interruption monitoring
- Answer timing analysis
- Answer-change tracking
- Paste-event detection
- Answer similarity analysis
- Student-to-student answer similarity for applicable descriptive answers
- Statistical/ML anomaly analysis
- Combined anomaly score
- Live faculty monitoring
- Student anomaly profiles
- Incident timeline
- Faculty review actions
- Faculty-controlled examination termination
- Basic security and role-based access

### 4.2 Out of Scope for MVP

- Webcam monitoring
- Microphone monitoring
- Continuous screen recording
- Mandatory screen sharing
- Automatic exam termination
- Full internet-wide plagiarism detection
- Guaranteed AI-generated-answer detection
- Deep-learning-based cheating classification
- Large-scale institutional administration features

---

## 5. Stakeholders and Actors

### 5.1 Student

The student accesses assigned examinations, answers questions, submits answers, and generates behavioural and answering events during the examination.

### 5.2 Faculty

The faculty member creates examinations, adds questions and reference answers, monitors active examinations, investigates anomalies, reviews incidents, and makes final decisions regarding suspicious behaviour.

### 5.3 Anomaly Detection System

The system collects examination events, extracts behavioural features, analyzes answering patterns, calculates anomaly signals, generates anomaly scores, creates incidents, and updates the faculty monitoring interface.

---

## 6. Overall System Description

AnomalyDash consists conceptually of two primary interfaces.

### Student Portal

Used to:

- access examinations,
- view questions,
- answer questions,
- submit answers,
- complete the examination.

### Faculty Portal

Used to:

- create examinations,
- monitor active examinations,
- view student anomaly scores,
- inspect incidents,
- review student behaviour,
- take appropriate action.

### Anomaly Detection Layer

Conceptually:

    Student Examination
            |
            v
    Behaviour + Answer Collection
            |
            v
       Feature Extraction
            |
       +----+----+
       |         |
       v         v
    Evidence   Statistical/
    Signals       ML Analysis
       |         |
       +----+----+
            |
            v
     Combined Anomaly Score
            |
            v
     Faculty Monitoring
            |
            v
     Faculty Investigation

---

## 7. Functional Requirements

### FR-01 — Authentication and Access

The system shall provide appropriate authentication and role-based access for students and faculty.

Students shall only access examinations assigned to them.

Faculty shall only access examinations and monitoring information they are authorized to manage.

### FR-02 — Examination Creation

Faculty shall be able to create an examination containing:

- examination title,
- duration,
- questions,
- marks,
- question type,
- examination instructions.

### FR-03 — MCQ Questions

The system shall allow faculty to create multiple-choice questions with predefined options and correct answers.

### FR-04 — Descriptive Questions

The system shall allow faculty to create questions requiring students to enter text-based answers.

### FR-05 — Reference Answers

Faculty shall be able to provide a reference answer for descriptive questions.

### FR-06 — Student Examination

Students shall be able to access an assigned examination, view questions, enter answers, navigate through questions, and submit the examination.

### FR-07 — Examination Timer

The system shall display the remaining examination time and prevent submissions from remaining active beyond the configured duration.

### FR-08 — Behaviour Event Collection

The system shall record relevant examination behaviour events with timestamps.

Examples:

- `TAB_HIDDEN`
- `TAB_VISIBLE`
- `FOCUS_LOST`
- `FOCUS_REGAINED`
- `OFFLINE`
- `ONLINE`

### FR-09 — Away Duration

The system shall calculate how long a student remains away from the examination page or browser focus.

### FR-10 — Repeated Behaviour Tracking

The system shall track repeated occurrences of relevant events, including focus-loss count, tab visibility changes, total away duration, and longest away duration.

### FR-11 — Network Events

Network/session interruptions shall be recorded as contextual events. A network interruption alone shall not automatically increase the suspiciousness of a student.

### FR-12 — Answer Timing

The system shall record relevant timestamps including question start/view time, first response time, submission time, and response duration.

### FR-13 — Answer Changes

For applicable questions, the system shall track meaningful answer changes.

### FR-14 — Skipped Questions

The system shall record questions that are skipped or left unanswered.

### FR-15 — Answering Pattern Analysis

The system shall derive answering-pattern features such as:

- average response time,
- response-time variation,
- unusually fast responses,
- unusually slow responses,
- sudden changes in response behaviour,
- answer-change frequency.

### FR-16 — Paste Event Monitoring

The system shall detect paste actions occurring within supported answer fields and record the event timestamp and question context.

The system shall not store the contents of the user's clipboard.

### FR-17 — Answer Similarity

For descriptive questions, the system shall compare a student's answer with the faculty-provided reference answer and produce a similarity value or category.

The similarity result shall be treated as a signal for review, not definitive proof of misconduct.

### FR-18 — Student-to-Student Answer Similarity

For applicable descriptive questions, the system may compare submitted answers between students to identify unusually high similarity.

Similarity in response timing may also be considered when evaluating potential collusion.

### FR-19 — Behavioural Feature Extraction

The system shall transform collected events into meaningful features for anomaly analysis, potentially including:

- tab-switch count,
- focus-loss count,
- total away duration,
- maximum away duration,
- average response time,
- response-time variation,
- answer-change count,
- paste-event count,
- unusually fast answer count,
- recent activity frequency,
- answer similarity signals,
- student-to-student similarity signals.

### FR-20 — Statistical/ML Anomaly Detection

The system shall analyze extracted features to identify behaviour that significantly differs from expected examination behaviour.

The MVP shall prefer an unsupervised/statistical anomaly-detection approach because a reliable labelled cheating dataset is not available.

The exact algorithm and parameters shall be defined during system design.

### FR-21 — Combined Anomaly Analysis

The system shall consider multiple signals together rather than automatically treating a single event as proof of suspicious behaviour.

Examples include:

- focus loss + long absence + unusual response time,
- focus loss + paste + rapid submission,
- focus loss + paste + high answer similarity,
- high student-to-student similarity + similar timing,
- repeated interruptions + significant behavioural deviation.

### FR-22 — Anomaly Score

The system shall generate an anomaly/risk score from **0 to 100**.

The score represents the level of unusual behaviour detected and is not a probability that the student cheated.

Default status ranges shall be:

| Score | Default Status |
|---:|---|
| 0–29 | Normal |
| 30–59 | Attention |
| 60–79 | Suspicious |
| 80–100 | High Risk |

Faculty shall be able to modify the score thresholds before an examination begins.

The score shall be explainable through the incidents and signals contributing to it.

### FR-23 — Anomaly Incident Creation

When meaningful anomalous behaviour is detected, the system shall create an incident containing:

- incident type,
- timestamp,
- student,
- examination,
- relevant event information,
- associated signal/score.

### FR-24 — Live Faculty Monitoring

Faculty shall have access to a live monitoring page showing active students, including:

- roll number,
- student name/identifier,
- current status,
- anomaly score.

### FR-25 — Anomalous Student Prioritization

Students with significant anomaly activity shall be visually highlighted and prioritized near the top of the faculty monitoring list.

### FR-26 — Student Anomaly Profile

Faculty shall be able to select a student and view:

- current anomaly score,
- incident history,
- event timeline,
- tab/focus activity,
- away durations,
- answer-pattern signals,
- answer similarity signals,
- paste events,
- contributing anomaly factors.

### FR-27 — Real-Time Updates

The faculty monitoring interface shall receive newly generated incidents and updated anomaly information during an active examination without requiring unnecessary manual page refreshes.

### FR-28 — Faculty Review

Faculty shall be able to review detected incidents and classify them appropriately.

Possible actions include:

- Review,
- Dismiss,
- Mark as suspicious.

### FR-29 — Faculty-Controlled Termination

Faculty may terminate a student's examination when appropriate.

The system shall not automatically terminate an examination solely because an anomaly has been detected.

### FR-30 — Audit Information

Important faculty actions and relevant anomaly decisions should be recorded to support traceability.

---

## 8. Behavioural Monitoring Requirements

AnomalyDash shall follow a minimum-data monitoring approach.

### 8.1 Monitored Behaviour

- tab/page visibility,
- browser focus,
- duration away from the examination,
- repeated interruptions,
- network/session interruptions,
- paste actions within supported answer fields.

### 8.2 Non-Monitored Data

The MVP shall not require:

- webcam video,
- microphone audio,
- continuous screen recording,
- browsing history,
- personal files,
- clipboard contents.

### 8.3 Event Structure

Conceptually, an event contains:

    Event Type
    Student ID
    Exam ID
    Session ID
    Timestamp
    Relevant Metadata
    Duration (when applicable)

---

## 9. Answering Behaviour Requirements

The system shall analyze how students answer questions, not only what they answer.

Potential indicators include:

- response time,
- response-time variation,
- answer changes,
- skipped questions,
- sudden changes in answering speed,
- unusually rapid responses,
- unusual response sequences,
- paste events.

The system should compare behaviour against appropriate examination baselines.

---

## 10. Answer Similarity Requirements

For descriptive questions:

1. Faculty provides a reference answer.
2. Student submits a text answer.
3. The system calculates semantic similarity.
4. The similarity becomes an anomaly/evidence signal where appropriate.
5. Faculty can inspect the similarity result in the student's anomaly history.

The system shall not claim that a high similarity score proves that a student cheated or used AI.

Internet-wide source searching and reliable AI-generated-text detection are outside the core MVP.

Student-to-student similarity may be used to identify possible collusion, particularly when unusually high answer similarity is combined with similar response timing or unusual shared wording.

---

## 11. Anomaly Detection Requirements

AnomalyDash shall use multiple sources of evidence.

### Layer 1 — Direct Event Evidence

Examples:

- repeated focus loss,
- tab visibility changes,
- long away periods,
- paste events.

### Layer 2 — Answering Behaviour

Examples:

- abnormal response speed,
- sudden response-time changes,
- repeated answer changes.

### Layer 3 — Similarity Signals

Examples:

- unusually high similarity with a reference answer,
- unusually high similarity between student answers.

### Layer 4 — Statistical/ML Detection

The system shall identify students whose combined behavioural features significantly deviate from expected patterns.

A lightweight unsupervised approach such as Isolation Forest may be evaluated during implementation.

### Evidence Combination Principles

The following combinations shall be treated as strong candidate anomaly patterns:

| Combination | Expected Signal |
|---|---|
| Repeated focus loss + significant away time | Attention / Suspicious |
| Focus loss + long absence + unusual response time | Strong anomaly |
| Focus loss + paste + very rapid answer | High anomaly |
| Focus loss + paste + high answer similarity | Very strong anomaly |
| High student-to-student similarity + similar timing | Potential collusion |
| Multiple interruptions + significant deviation from baseline | Strong anomaly |
| Multiple behavioural signals + ML outlier score | Elevated anomaly |

These are detection signals, not automatic conclusions of misconduct.

### Core Principle

> **AnomalyDash detects unusual behaviour; it does not automatically declare a student guilty of cheating.**

---

## 12. Faculty Monitoring Requirements

The faculty monitoring interface shall prioritize simplicity.

The primary view should allow faculty to quickly answer:

1. Which students need attention?
2. Why were they flagged?
3. How severe is the anomaly?
4. What happened and when?

The interface should prioritize:

- student list,
- anomaly score,
- status,
- live incident indicators,
- student investigation view.

---

## 13. Non-Functional Requirements

### 13.1 Performance

The monitoring system shall process behavioural events without noticeably disrupting the student's examination experience.

### 13.2 Real-Time Responsiveness

New anomaly incidents should become visible to faculty with minimal delay.

### 13.3 Reliability

A failure in anomaly processing should not unnecessarily terminate or corrupt a student's examination.

### 13.4 Security

The system shall implement appropriate:

- authentication,
- authorization,
- input validation,
- secure session handling,
- protection of sensitive examination data.

### 13.5 Privacy

Only information required for examination functionality and anomaly analysis should be collected.

### 13.6 Usability

The student examination interface should remain simple and distraction-free.

The faculty monitoring interface should make anomalous students easy to identify.

### 13.7 Explainability

Every significant anomaly should provide understandable contributing evidence.

### 13.8 Maintainability

The system should separate:

- examination functionality,
- event collection,
- feature extraction,
- anomaly detection,
- faculty monitoring.

### 13.9 Fairness

The system shall avoid relying on a single behavioural event as definitive evidence. Potential false positives must be expected, and faculty review shall remain part of the decision process.

---

## 14. Privacy and Security Requirements

1. Students shall be informed about relevant monitoring performed during examinations.
2. The examination portal shall warn students not to close or open other tabs/windows while the examination is active.
3. Students shall not be shown the internal anomaly score or individual detection rules during the examination.
4. Only required examination behaviour data shall be collected.
5. Faculty access to student monitoring information shall be restricted.
6. Student answers and examination information shall be protected from unauthorized access.
7. The system shall not collect webcam or microphone data in the MVP.
8. Raw screen recording shall not be required in the MVP.
9. Network interruptions shall not independently classify a student as suspicious.
10. Anomaly scores shall be treated as decision-support information.
11. Sensitive credentials and configuration information shall not be exposed to clients.
12. Clipboard contents shall not be stored.

---

## 15. Assumptions and Constraints

### Assumptions

- Students use a supported modern web browser.
- Students have reasonable network connectivity.
- Browser APIs can provide visibility and focus events.
- Faculty provide valid examination questions and reference answers where required.
- The system can collect sufficient data during an examination to establish behavioural patterns.

### Constraints

- The project has a limited 24-hour hackathon development window.
- There is no reliable labelled dataset containing confirmed cheating/non-cheating examples.
- Browser-based monitoring cannot guarantee prevention of all forms of cheating.
- Behavioural anomalies may have legitimate explanations.
- AI-generated-answer detection cannot be reliably guaranteed in the MVP.
- The system must remain lightweight enough to run as a hackathon MVP.

---

## 16. Use Cases

### UC-01 — Faculty Creates Examination

**Actor:** Faculty

1. Faculty logs in.
2. Faculty creates an examination.
3. Faculty specifies duration and marks.
4. Faculty adds questions.
5. Faculty provides reference answers for descriptive questions.
6. Faculty configures anomaly thresholds if desired.
7. Faculty publishes the examination and receives an examination code.

### UC-02 — Student Takes Examination

**Actor:** Student

1. Student logs in.
2. Student enters the examination code.
3. System verifies access.
4. System displays examination instructions.
5. Student starts the examination.
6. System starts the timer and event collection.
7. Student answers questions.
8. Student submits the examination.
9. System stores responses and relevant events.

### UC-03 — System Monitors Behaviour

**Actor:** System

1. Student begins examination.
2. Behaviour events are generated.
3. Events are timestamped.
4. Events are processed.
5. Relevant features are extracted.

### UC-04 — System Analyzes Answers

**Actor:** System

1. Student answers questions.
2. Response timing and answer changes are recorded.
3. Paste events are recorded where applicable.
4. Descriptive answers are compared with reference answers.
5. Student-to-student similarity may be calculated.
6. Answering-pattern features are generated.

### UC-05 — System Detects Anomaly

**Actor:** System

1. Behavioural features are collected.
2. Answering features are collected.
3. Multiple signals are analyzed.
4. Statistical/ML analysis is performed.
5. Anomaly score is calculated.
6. An incident is generated when appropriate.

### UC-06 — Faculty Monitors Examination

**Actor:** Faculty

1. Faculty opens the live monitoring page.
2. Active students are displayed.
3. Anomalous students are highlighted.
4. New incidents appear in real time.
5. Faculty selects students requiring investigation.

### UC-07 — Faculty Investigates Student

**Actor:** Faculty

1. Faculty selects a student.
2. System displays the anomaly profile.
3. Faculty reviews incident history.
4. Faculty examines contributing evidence.
5. Faculty decides whether further action is required.

### UC-08 — Faculty Takes Action

Possible actions:

- Dismiss incident
- Mark student as suspicious
- Terminate examination

The system does not automatically perform punitive action based solely on an anomaly score.

---

## 17. MVP Definition

### Must Have

- Faculty login
- Student login
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
- Combined 0–100 anomaly score
- Configurable faculty thresholds
- Incident generation
- Live faculty monitoring
- Anomalous-student prioritization
- Student anomaly profile
- Faculty review
- Faculty-controlled termination

### Optional If Time Permits

- More advanced answer-source comparison
- Additional configurable anomaly policies
- Advanced visual analytics
- Historical examination comparison

### Explicitly Not Required for MVP

- Webcam proctoring
- Microphone monitoring
- Continuous screen recording
- Mandatory screen sharing
- Automatic punishment
- Guaranteed AI-content detection
- Complex deep-learning systems

---

## 18. Demonstration Scenario

The primary hackathon demonstration shall use the three-person CodeMatriX team.

### Faculty

One team member signs into the faculty account and creates a test.

The faculty:

1. Creates questions.
2. Adds reference answers.
3. Sets the exam duration.
4. Configures anomaly thresholds.
5. Publishes the exam.
6. Shares the examination code with the other two team members.

### Genuine Student

The second team member logs into a student account and enters the examination code.

They answer normally without suspicious interruptions.

Expected result:

    Student A
    Status: Normal
    Anomaly Score: Low

### Simulated Suspicious Student

The third team member logs into another student account using the same examination code.

During a descriptive question, the student deliberately performs a simulated suspicious workflow:

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

The faculty dashboard should receive the resulting events in real time.

Example incident sequence:

    10:32:14  Focus lost
    10:32:14  Tab hidden

    10:32:57  Focus regained
              Away duration: 43 seconds

    10:33:01  Paste detected

    10:33:05  Answer submitted
              Response time: 4 seconds

    10:33:06  High answer similarity detected

The student's anomaly score should increase because of the combination of signals.

The faculty can then open the student profile and see the incident timeline and contributing factors.

### Demonstration Message

The team should communicate the core value as:

> **“AnomalyDash does not decide that a student cheated. It detects combinations of unusual signals and gives faculty the evidence needed to investigate.”**

---

## 19. Acceptance Criteria

The MVP shall be considered functionally successful if:

1. Faculty can create an examination.
2. Faculty can configure anomaly thresholds before the examination.
3. Students can enter the examination using a code.
4. Students can complete the examination.
5. The examination timer functions correctly.
6. Behavioural events are captured during the examination.
7. Away duration can be calculated.
8. Answer timing and answer changes are recorded.
9. Paste events can be detected without storing clipboard contents.
10. Descriptive answers can be compared with reference answers.
11. Applicable student-to-student answer similarity can be calculated.
12. The anomaly engine produces an explainable 0–100 score.
13. The system can identify combinations of unusual behaviour.
14. Faculty can see anomaly information during an active examination.
15. Anomalous students are visually prioritized.
16. Faculty can inspect the reasons behind an anomaly.
17. Anomaly incidents appear in the student's history/timeline.
18. Faculty retains control over disciplinary decisions.
19. The system does not automatically terminate students based solely on anomaly detection.
20. No webcam, microphone, or continuous screen recording is required.
21. The system remains usable while anomaly processing is active.

---

## 20. Future Enhancements

Potential future versions may include:

- Optional webcam-based monitoring
- Optional screen-sharing/review functionality
- More advanced answer-source similarity
- Historical student behaviour baselines
- Larger labelled datasets for supervised ML
- Advanced anomaly models
- Institution-wide examination analytics
- Configurable faculty policies
- Automated notifications
- Advanced examination integrity reports
- Explainable ML visualizations

---

## 21. Requirements Baseline

This SRS v0.1 establishes the functional and behavioural requirements baseline for AnomalyDash.

Implementation technologies, database structure, API contracts, exact anomaly-engine implementation, and model parameters shall be defined separately during the design stage.

The central design principle is:

> **Behaviour + Answering Patterns → Anomaly Detection → Explainable Evidence → Faculty Decision**

AnomalyDash is therefore an intelligent examination monitoring and decision-support platform rather than a conventional online examination website or an automatic cheating-detection system.

---

**End of SRS v0.1**
