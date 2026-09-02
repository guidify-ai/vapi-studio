import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  appendChat,
  appendNodeVisit,
  compactText,
  countNodeVisits,
  emptyConversationHistory,
  lastVisitedNodeId,
} from '../dist/conversation/conversation-history.js';

describe('Conversation history', () => {
  it('skips empty user lines and records compact assistant text', () => {
    const h = emptyConversationHistory();
    appendChat(h, 'user', '   ');
    appendChat(h, 'assistant', 'Hello there');
    appendChat(h, 'user', 'I need an estimate');
    assert.equal(h.chat.length, 2);
    assert.equal(h.chat[0].role, 'assistant');
    assert.equal(h.chat[1].text, 'I need an estimate');
    assert.ok(compactText('a'.repeat(400)).endsWith('…'));
  });

  it('tracks node path for before() decisions', () => {
    const h = emptyConversationHistory();
    appendNodeVisit(h, {
      nodeId: 'acknowledge',
      intention: 'isAcknowledged',
      turnNumber: 1,
      at: 't1',
    });
    appendNodeVisit(h, {
      nodeId: 'roofEstimate',
      intention: 'isRequestedRoofEstimate',
      turnNumber: 2,
      at: 't2',
    });
    assert.equal(lastVisitedNodeId(h), 'roofEstimate');
    assert.equal(countNodeVisits(h, 'acknowledge'), 1);
  });
});
