import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyListenBoosts } from '../dist/conversation/listen-expectation.js';

describe('ListenExpectation boosts', () => {
  it('lowers rank for boosted intentions (higher priority)', () => {
    const out = applyListenBoosts(
      [
        { name: 'isAcknowledge', rank: 100 },
        { name: 'studio.isGoodbye', rank: 100 },
        { name: 'isMultiSayTest', rank: 100 },
      ],
      {
        intentions: [
          { name: 'isMultiSayTest', boost: 20 },
          { name: 'studio.isGoodbye', boost: 5 },
        ],
        hints: ['user may ask what next'],
      },
    );
    const byName = Object.fromEntries(out.map((c) => [c.name, c.rank]));
    assert.equal(byName.isMultiSayTest, 80);
    assert.equal(byName['studio.isGoodbye'], 95);
    assert.equal(byName.isAcknowledge, 100);
    assert.ok(byName.isMultiSayTest < byName['studio.isGoodbye']);
  });
});
