'use strict';
// Retry backoff once it reaches its cap (verification round R2-1): the delay keeps its jitter, so many
// TVs (or many channels) never retry in lock-step, and it never exceeds the cap by more than 25 %.
// The request budgets (guide ≤ 5 / 10 min, list ≤ 12 / 30 min) are pinned in guide/list-load tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./harness');
const f = require('./fixtures');

const CASES = [['player', 'RETRY_MIN_MS', 'MAX_BACKOFF_MS'], ['guide', 'GUIDE_RETRY_MIN_MS', 'GUIDE_RETRY_MAX_MS'],
  ['list', 'LIST_RETRY_MIN_MS', 'LIST_RETRY_MAX_MS']];

for (const [name, minKey, maxKey] of CASES) {
  test('backoff (' + name + '): once capped (attempt ≥ 6) delays keep jitter and stay ≤ 1.25 × cap', () => {
    const app = createApp();
    const C = app.ctx.CONFIG, min = C[minKey], max = C[maxKey];
    const samples = [];
    for (let n = 6; n < 11; n++) for (let i = 0; i < 40; i++) samples.push(app.ctx.Util.backoff(n, min, max));
    const distinct = new Set(samples).size;
    assert.ok(distinct > 1, 'all ' + samples.length + ' capped delays are ' + samples[0] + ' ms (no jitter)');
    assert.ok(Math.max(...samples) <= max * 1.25, 'longest capped delay ' + Math.max(...samples) + ' ms > 1.25 × ' + max);
  });
}

test('backoff (player): a stream failing over and over is retried at varying delays once capped', () => {
  const app = f.ottApp({ channels: 5, boot: false });
  app.av.prepareFails = true;
  app.boot();
  const opens = () => app.av.calls.filter((c) => c.fn === 'open');
  app.advanceUntil(() => opens().length >= 14, 600000, 50);
  const at = opens().map((c) => c.at);
  const gaps = at.slice(1).map((t, i) => t - at[i]).slice(7);   // attempts 8+ are capped (0.5 s × 2^n ≥ 15 s)
  assert.ok(gaps.length >= 5, 'not enough retries: ' + opens().length);
  assert.ok(new Set(gaps).size > 1, 'capped retry gaps are identical: ' + gaps.join(', '));
});
