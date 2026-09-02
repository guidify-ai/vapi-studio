import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allBelowConfidenceThreshold,
  orderIntentionsForWalk,
  resolveConfidenceThreshold,
  scoresToRankedCandidates,
  selectWalkableIntentions,
} from '../dist/brain/brain-ranking.js';
import { STANDARD_INTENTIONS } from '../dist/intentions/standard-intentions.js';

describe('Brain ranking / unknown transition', () => {
  it('detects all scores below 40% threshold', () => {
    assert.equal(
      allBelowConfidenceThreshold(
        [
          { name: 'isContinue', confidence: 0.22 },
          { name: 'studio.isMad', confidence: 0.18 },
        ],
        0.4,
      ),
      true,
    );
    assert.equal(
      allBelowConfidenceThreshold(
        [
          { name: 'isContinue', confidence: 0.55 },
          { name: 'studio.isMad', confidence: 0.1 },
        ],
        0.4,
      ),
      false,
    );
  });

  it('clamps confidence to 0..1 with 6 decimal places', () => {
    const ranked = scoresToRankedCandidates(
      [
        { name: 'isContinue', confidence: 1.5 },
        { name: 'isMultiSayTest', confidence: 0.123456789 },
      ],
      [
        { name: 'isMultiSayTest', boost: 30, priority: 2 },
        { name: 'isContinue', boost: 0, priority: 1 },
      ],
    );
    assert.equal(ranked[0].confidence, 1);
    assert.equal(ranked[1].confidence, 0.123457);
    assert.ok(ranked.every((r) => r.confidence <= 1));
  });

  it('walk order is priority desc then name A–Z', () => {
    const walked = orderIntentionsForWalk([
      {
        name: 'isZebra',
        confidence: 0.9,
        priority: 1,
        rank: 0,
      },
      {
        name: 'isAlpha',
        confidence: 0.2,
        priority: 1,
        rank: 0,
      },
      {
        name: 'studio.isMad',
        confidence: 0.5,
        priority: 10,
        rank: 0,
      },
    ]);
    assert.deepEqual(
      walked.map((i) => i.name),
      ['studio.isMad', 'isAlpha', 'isZebra'],
    );
  });

  it('selectWalkableIntentions drops below-threshold except unknown fallback', () => {
    const walked = selectWalkableIntentions(
      [
        {
          name: 'isContinue',
          confidence: 0.22,
          priority: 1,
          rank: 0,
        },
        {
          name: STANDARD_INTENTIONS.isUnknownTransition,
          confidence: 0,
          priority: 0,
          rank: 0,
        },
      ],
      0.4,
      STANDARD_INTENTIONS.isUnknownTransition,
    );
    assert.equal(walked.length, 1);
    assert.equal(walked[0].name, STANDARD_INTENTIONS.isUnknownTransition);
  });

  it('resolves threshold from explicit value, else 0.4', () => {
    assert.equal(resolveConfidenceThreshold(), 0.4);
    assert.equal(resolveConfidenceThreshold(0.55), 0.55);
    assert.equal(resolveConfidenceThreshold(Number.NaN), 0.4);
    assert.equal(STANDARD_INTENTIONS.isUnknownTransition, 'studio.isUnknownTransition');
  });
});
