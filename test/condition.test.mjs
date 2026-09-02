/**
 * Safe condition expression compiler for flow transitions.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compileCondition,
  evaluateCondition,
} from '../dist/flow/condition.js';
import {
  FlowLoader,
  conditionGotoIntention,
  parseConditionGotoNodeId,
} from '../dist/flow/flow-loader.js';

describe('compileCondition', () => {
  it('evaluates memory equality and nullish', () => {
    const eq = compileCondition('memory.formSendConsent == true');
    assert.equal(eq({ memory: { formSendConsent: true }, variables: {} }), true);
    assert.equal(eq({ memory: { formSendConsent: false }, variables: {} }), false);
    assert.equal(eq({ memory: {}, variables: {} }), false);

    const undef = compileCondition('memory.formSendConsent == undefined');
    assert.equal(undef({ memory: {}, variables: {} }), true);
    assert.equal(
      undef({ memory: { formSendConsent: false }, variables: {} }),
      false,
    );
  });

  it('supports && || ! and parentheses', () => {
    const expr =
      'memory.formSendConsent == true && memory.phoneConfirmed != true';
    assert.equal(
      evaluateCondition(expr, {
        memory: { formSendConsent: true },
        variables: {},
      }),
      true,
    );
    assert.equal(
      evaluateCondition(expr, {
        memory: { formSendConsent: true, phoneConfirmed: true },
        variables: {},
      }),
      false,
    );
    assert.equal(
      evaluateCondition('!memory.contactPhone', {
        memory: {},
        variables: {},
      }),
      true,
    );
    assert.equal(
      evaluateCondition(
        '(memory.a == true || memory.b == true) && variables.callerChannel == phone',
        {
          memory: { b: true },
          variables: { callerChannel: 'phone' },
        },
      ),
      true,
    );
  });
});

describe('FlowLoader condition transitions', () => {
  it('compiles transitions and matches force gates', () => {
    const flow = new FlowLoader();
    flow.loadFromObject({
      version: 1,
      flow: { id: 't', start: 'a' },
      nodes: {
        a: { class: 'A', intentions: ['isA'] },
        askSmsPhone: { class: 'P', intentions: ['isCollectedPhone'] },
        identityCollect: { class: 'I', intentions: ['isIdentity'] },
      },
      transitions: [
        {
          id: 'needSmsPhone',
          from: ['identityCollect', 'a'],
          to: 'askSmsPhone',
          when: 'memory.formSendConsent == true && memory.phoneConfirmed != true',
          force: true,
          reason: 'need_sms_phone',
        },
      ],
    });

    const hit = flow.matchingConditionTransitions(
      {
        currentNodeId: 'identityCollect',
        memory: { formSendConsent: true },
        variables: {},
      },
      { force: true },
    );
    assert.equal(hit.length, 1);
    assert.equal(hit[0].id, 'needSmsPhone');

    const onTarget = flow.matchingConditionTransitions(
      {
        currentNodeId: 'askSmsPhone',
        memory: { formSendConsent: true },
        variables: {},
      },
      { force: true },
    );
    assert.equal(onTarget.length, 0);

    assert.equal(parseConditionGotoNodeId(conditionGotoIntention('askSmsPhone')), 'askSmsPhone');
    assert.deepEqual(flow.nodesForIntention(conditionGotoIntention('askSmsPhone')).map((n) => n.id), [
      'askSmsPhone',
    ]);
  });

  it('rejects invalid when at load', () => {
    const flow = new FlowLoader();
    assert.throws(() =>
      flow.loadFromObject({
        version: 1,
        flow: { id: 't', start: 'a' },
        nodes: { a: { class: 'A', intentions: [] } },
        transitions: [{ id: 'bad', to: 'a', when: 'memory.x ===' }],
      }),
    );
  });
});
