import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { buildDesignPackage } from '../dist/conversation/lib/build-design-package.js';
import { PLANNER_FUNNELS, PLANNER_ANALYTICS_TAGS } from '../dist/analytics/planner-funnels.js';

describe('planner design package', () => {
  it('builds sample + funnels fail-closed', () => {
    const draft = buildDesignPackage({
      companyName: 'Acme HVAC',
      companyDoes: 'fixes heating and cooling',
      useCase: 'qualify',
      discoveryAnswers: ['name and callback', 'angry callers transfer'],
      integrationInterest: 'none',
    });
    assert.ok(draft.sampleConversation.includes('Acme HVAC'));
    assert.ok(draft.flowNodes.length >= 4);
    assert.ok(draft.funnels.length >= 1);
    assert.ok(draft.analyticsEvents.includes('call_started'));
  });
});

describe('planner analytics catalog', () => {
  it('exposes planner design funnel milestones', () => {
    assert.equal(PLANNER_FUNNELS[0].id, 'planner_design');
    const tags = PLANNER_FUNNELS[0].steps.flatMap((s) => s.tags || []);
    assert.ok(tags.includes(PLANNER_ANALYTICS_TAGS.useCaseSet));
    assert.ok(tags.includes(PLANNER_ANALYTICS_TAGS.sampleShown));
    assert.ok(tags.includes(PLANNER_ANALYTICS_TAGS.quoteRequested));
  });
});

describe('planner flow.yaml', () => {
  it('starts at acknowledge with planner id', async () => {
    const { readFileSync } = await import('node:fs');
    const yaml = readFileSync(join(process.cwd(), 'config/flow.yaml'), 'utf8');
    assert.match(yaml, /id:\s*sample-landing-planner/);
    assert.match(yaml, /start:\s*acknowledge/);
    assert.doesNotMatch(yaml, /RoofEstimate|askFormSendConsent|routerTriage/);
    assert.match(yaml, /class:\s*DesignPackageNode/);
    assert.match(yaml, /class:\s*ShowSampleNode/);
  });
});
