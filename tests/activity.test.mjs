import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityBucket, activitySeries, presetRange } from '../lib/activity.ts';
test('UTC presets include today and Monday-start weeks across year boundaries', () => {
  assert.deepEqual(presetRange('week', '2027-01-03'), { from: '2026-12-28', to: '2027-01-03' });
  assert.deepEqual(presetRange('month', '2026-10-21'), { from: '2026-10-01', to: '2026-10-21' });
  assert.deepEqual(presetRange('7days', '2026-03-02'), { from: '2026-02-24', to: '2026-03-02' });
  assert.deepEqual(presetRange('today', '2026-10-21'), { from: '2026-10-21', to: '2026-10-21' });
});
test('weekly and monthly buckets use calendar boundaries', () => {
  assert.equal(activityBucket('2026-10-25', 'week'), '2026-10-19');
  assert.equal(activityBucket('2026-10-26', 'week'), '2026-10-26');
  assert.equal(activityBucket('2024-02-29', 'month'), '2024-02-01');
});
test('series preserves zero-activity days and counts interview rounds separately', () => {
  const series = activitySeries('2026-10-19', '2026-10-21', 'day', [
    { date: '2026-10-19', kind: 'applied', count: 2 }, { date: '2026-10-21', kind: 'interview_completed', count: 3 },
  ]);
  assert.equal(series.length, 3); assert.equal(series[0].applied, 2);
  assert.equal(Object.values(series[1]).filter(value => typeof value === 'number').reduce((a,b) => a+b), 0);
  assert.equal(series[2].interview_completed, 3);
  assert.equal(activitySeries('2026-12-20', '2027-02-03', 'month', []).length, 3);
});
