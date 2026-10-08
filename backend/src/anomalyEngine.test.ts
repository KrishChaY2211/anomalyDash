import test from 'node:test';
import assert from 'node:assert/strict';
import { answerSimilarity, extractFeatures, scoreAnomaly } from './anomalyEngine.js';

test('extractFeatures summarizes monitoring events and answer completion', () => {
  const features = extractFeatures([
    { type: 'TAB_HIDDEN', metadata: null, createdAt: new Date('2026-01-01T00:00:00Z') },
    { type: 'TAB_VISIBLE', metadata: JSON.stringify({ awayDurationMs: 12000 }), createdAt: new Date('2026-01-01T00:00:12Z') },
    { type: 'PASTE', metadata: null, createdAt: new Date('2026-01-01T00:00:15Z') },
    { type: 'ANSWER_CHANGED', metadata: JSON.stringify({ responseTimeMs: 5000 }), createdAt: new Date('2026-01-01T00:00:20Z') }
  ], [
    { questionId: 'q1', answer: 'A response' },
    { questionId: 'q2', answer: '   ' }
  ], 3, new Date('2026-01-01T00:00:00Z'));

  assert.equal(features.tabSwitchCount, 1);
  assert.equal(features.pasteCount, 1);
  assert.equal(features.totalAwayMs, 12000);
  assert.equal(features.answeredQuestionCount, 1);
  assert.equal(features.unansweredQuestionCount, 2);
  assert.equal(features.averageResponseMs, 5000);
});

test('scoreAnomaly combines event weights and labels using configured thresholds', () => {
  const result = scoreAnomaly([
    { type: 'TAB_HIDDEN', metadata: null, createdAt: new Date() },
    { type: 'PASTE', metadata: null, createdAt: new Date() }
  ], { lowThreshold: 10, mediumThreshold: 30, highThreshold: 60 });

  assert.equal(result.score, 26);
  assert.equal(result.anomalyLevel, 'LOW');
  assert.ok(result.factors.some(factor => factor.type === 'FOCUS_LOSS_WITH_PASTE'));
  assert.match(result.note, /not proof of misconduct/);
});

test('answerSimilarity uses token overlap and handles empty answers', () => {
  assert.equal(answerSimilarity('The quick brown fox', 'the quick brown fox'), 100);
  assert.equal(answerSimilarity('', 'any text'), 0);
  assert.equal(answerSimilarity('alpha beta', 'gamma delta'), 0);
});
