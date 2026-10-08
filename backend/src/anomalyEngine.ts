export type EventRecord = {
  type: string;
  metadata: string | null;
  createdAt: Date | string;
};

export type AnswerRecord = {
  questionId: string;
  answer: string;
  updatedAt?: Date | string;
};

type Thresholds = { lowThreshold: number; mediumThreshold: number; highThreshold: number };

const metadataOf = (raw: string | null): Record<string, unknown> => {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
};

const finitePositive = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function extractFeatures(
  events: EventRecord[],
  answers: AnswerRecord[],
  questionCount: number,
  startedAt?: Date | string
) {
  const counts: Record<string, number> = {};
  const awayDurations: number[] = [];
  const responseTimes: number[] = [];
  for (const event of events) {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
    const metadata = metadataOf(event.metadata);
    const away = finitePositive(metadata.awayDurationMs);
    if (away !== null && ['TAB_VISIBLE', 'FOCUS_REGAINED', 'WINDOW_FOCUS'].includes(event.type)) awayDurations.push(away);
    const response = finitePositive(metadata.responseTimeMs);
    if (response !== null && (event.type === 'ANSWER_CHANGED' || event.type === 'ANSWER_SUBMITTED')) responseTimes.push(response);
  }

  const answered = answers.filter(a => String(a.answer ?? '').trim().length > 0);
  const durations = awayDurations.slice().sort((a, b) => a - b);
  const totalAwayMs = durations.reduce((sum, n) => sum + n, 0);
  const averageResponseMs = responseTimes.length ? responseTimes.reduce((sum, n) => sum + n, 0) / responseTimes.length : 0;
  const responseTimeDeviationMs = responseTimes.length
    ? Math.sqrt(responseTimes.reduce((sum, n) => sum + (n - averageResponseMs) ** 2, 0) / responseTimes.length) : 0;
  const elapsedMs = startedAt ? Math.max(0, Date.now() - new Date(startedAt).getTime()) : 0;

  return {
    questionCount,
    answeredQuestionCount: answered.length,
    unansweredQuestionCount: Math.max(0, questionCount - answered.length),
    tabSwitchCount: counts.TAB_HIDDEN ?? 0,
    focusLossCount: (counts.FOCUS_LOST ?? 0) + (counts.WINDOW_BLUR ?? 0),
    focusRegainCount: (counts.FOCUS_REGAINED ?? 0) + (counts.WINDOW_FOCUS ?? 0),
    pasteCount: counts.PASTE ?? 0,
    copyCount: counts.COPY ?? 0,
    answerChangeCount: counts.ANSWER_CHANGED ?? 0,
    skippedQuestionCount: counts.SKIPPED_QUESTION ?? 0,
    offlineCount: counts.OFFLINE ?? 0,
    onlineCount: counts.ONLINE ?? 0,
    fullscreenExitCount: counts.FULLSCREEN_EXIT ?? 0,
    rapidAnswerCount: counts.RAPID_ANSWERS ?? 0,
    longIdleCount: counts.LONG_IDLE ?? 0,
    totalAwayMs,
    maxAwayMs: durations.length ? durations[durations.length - 1] : 0,
    averageAwayMs: durations.length ? Math.round(totalAwayMs / durations.length) : 0,
    averageResponseMs: Math.round(averageResponseMs),
    responseTimeDeviationMs: Math.round(responseTimeDeviationMs),
    responseSampleCount: responseTimes.length,
    elapsedMs,
    eventCounts: counts
  };
}

export function scoreAnomaly(events: EventRecord[], thresholds: Thresholds) {
  const weights: Record<string, number> = {
    TAB_HIDDEN: 8, WINDOW_BLUR: 5, FOCUS_LOST: 5, PASTE: 8, COPY: 2,
    RAPID_ANSWERS: 7, LONG_IDLE: 3, FULLSCREEN_EXIT: 7,
    TAB_VISIBLE: 0, WINDOW_FOCUS: 0, FOCUS_REGAINED: 0,
    OFFLINE: 0, ONLINE: 0, ANSWER_STARTED: 0, ANSWER_CHANGED: 0,
    ANSWER_SUBMITTED: 0, SKIPPED_QUESTION: 0
  };
  const counts: Record<string, number> = {};
  for (const event of events) counts[event.type] = (counts[event.type] ?? 0) + 1;

  const factors: Array<{ type: string; count: number; weight: number; contribution: number; explanation: string }> = [];
  for (const [type, count] of Object.entries(counts)) {
    const weight = weights[type] ?? 0;
    if (weight > 0 && count > 0) factors.push({
      type, count, weight, contribution: Math.min(weight * count, type === 'TAB_HIDDEN' ? 32 : 24),
      explanation: type === 'TAB_HIDDEN' ? 'Examination tab became hidden' :
        type === 'PASTE' ? 'Paste event detected in the examination page' :
        type === 'FULLSCREEN_EXIT' ? 'Fullscreen mode was exited' :
        type === 'RAPID_ANSWERS' ? 'Rapid-answer pattern was reported' :
        type === 'LONG_IDLE' ? 'Long idle period was reported' :
        type === 'COPY' ? 'Copy event was reported' : 'Browser or window focus was lost'
    });
  }

  const hasFocusLoss = (counts.TAB_HIDDEN ?? 0) + (counts.WINDOW_BLUR ?? 0) + (counts.FOCUS_LOST ?? 0) > 0;
  const addCombined = (type: string, contribution: number, explanation: string) => {
    factors.push({ type, count: 1, weight: contribution, contribution, explanation });
  };
  if (hasFocusLoss && (counts.PASTE ?? 0) > 0) addCombined('FOCUS_LOSS_WITH_PASTE', 10, 'Focus loss and paste activity occurred in the same attempt');
  if (hasFocusLoss && (counts.LONG_IDLE ?? 0) > 0) addCombined('FOCUS_LOSS_WITH_IDLE', 6, 'Focus loss coincided with a reported long idle period');
  if ((counts.TAB_HIDDEN ?? 0) + (counts.WINDOW_BLUR ?? 0) + (counts.FOCUS_LOST ?? 0) + (counts.FULLSCREEN_EXIT ?? 0) >= 3) {
    addCombined('REPEATED_INTERRUPTION', 6, 'Several focus or fullscreen interruptions were recorded');
  }

  const rawScore = factors.reduce((sum, factor) => sum + factor.contribution, 0);
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const anomalyLevel = score >= thresholds.highThreshold ? 'HIGH'
    : score >= thresholds.mediumThreshold ? 'MEDIUM'
    : score >= thresholds.lowThreshold ? 'LOW' : 'CLEAR';
  return {
    score, anomalyLevel, factors,
    method: 'explainable-rules-v1',
    note: 'This score highlights unusual recorded behaviour; it is not proof of misconduct and should be reviewed with context.'
  };
}

const normalizedTokens = (text: string) => new Set(
  text.toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+/gu) ?? []
);

export function answerSimilarity(answerA: string, answerB: string) {
  const a = normalizedTokens(answerA);
  const b = normalizedTokens(answerB);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  const union = new Set([...a, ...b]).size;
  return Math.round((intersection / union) * 100);
}
