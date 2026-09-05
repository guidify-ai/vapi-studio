(() => {
  const SESSION_KEY = 'vapi-studio-landing-session';

  function sessionId() {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  const chatLog = document.getElementById('chat-log');
  const typing = document.getElementById('typing');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatSend = document.getElementById('chat-send');
  const intakeForm = document.getElementById('intake-form');
  const intakeError = document.getElementById('intake-error');
  const intakeSubmit = document.getElementById('intake-submit');
  const flowPreview = document.getElementById('flow-preview');
  const funnelPreview = document.getElementById('funnel-preview');
  const samplePreview = document.getElementById('sample-preview');
  const desiredPreview = document.getElementById('desired-preview');
  const draftProduct = document.getElementById('draft-product');
  const dialog = document.getElementById('quote-dialog');
  const quoteForm = document.getElementById('quote-form');
  const quoteFields = document.getElementById('quote-fields');
  const quoteSuccess = document.getElementById('quote-success');
  const quoteError = document.getElementById('quote-error');
  const quoteFooter = document.getElementById('quote-footer');
  const quoteLead = document.querySelector('.modal-lead');

  if (!chatLog || !chatForm || !chatInput || !chatSend || !intakeForm) {
    console.error('[studio] chat DOM missing — planner cannot start');
    return;
  }

  const state = {
    sessionId: sessionId(),
    messages: [],
    draft: null,
    busy: false,
    /** True after contact intake — session may be completed. */
    active: false,
    completed: false,
  };

  const IDLE_MS = 30 * 60 * 1000;
  let idleTimer = null;

  function rotateSession() {
    const id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
    state.sessionId = id;
    state.messages = [];
    state.draft = null;
    state.active = false;
    state.completed = false;
  }

  function clearIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  function bumpIdleTimer() {
    clearIdleTimer();
    if (!state.active || state.completed) return;
    idleTimer = setTimeout(() => {
      completeSession('idle_timeout', true);
    }, IDLE_MS);
  }

  /** Close conversation; keep chat UI locked until refresh. Mint next sessionId for a future visit. */
  function completeSession(reason, showMessage) {
    if (state.completed || !state.active) return;
    const sid = state.sessionId;
    state.completed = true;
    state.active = false;
    clearIdleTimer();
    const payload = JSON.stringify({ sessionId: sid, reason });
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/design/complete', blob);
      } else {
        fetch('/api/design/complete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      /* best-effort */
    }
    chatInput.disabled = true;
    chatSend.disabled = true;
    if (showMessage) {
      const msg =
        reason === 'idle_timeout'
          ? 'Session closed after 30 minutes of inactivity. Refresh to start again.'
          : reason === 'guest_exit'
            ? 'Session closed. Refresh anytime to start a new planner chat.'
            : reason === 'transfer_human'
              ? 'Session closed — Guidify will follow up. Refresh anytime to start again.'
              : 'Session closed. Refresh to start again.';
      appendBubble('assistant', msg);
      state.messages = [
        ...(state.messages || []),
        { role: 'assistant', content: msg },
      ];
    }
    // Next page load uses a fresh id (current UI stays on the closed transcript).
    localStorage.setItem(SESSION_KEY, crypto.randomUUID());
  }

  function onServerCompleted(res) {
    if (!res?.completed) return;
    state.completed = true;
    state.active = false;
    clearIdleTimer();
    chatInput.disabled = true;
    chatSend.disabled = true;
    localStorage.setItem(SESSION_KEY, crypto.randomUUID());
  }

  function setBusy(busy, label) {
    state.busy = busy;
    typing.hidden = !busy;
    if (busy && label) typing.textContent = label;
    chatSend.disabled = busy || !chatInput.value.trim();
  }

  function buildSampleCallEl(sample) {
    const call = document.createElement('div');
    call.className = 'sample-call';
    (sample || []).forEach((line) => {
      const row = document.createElement('div');
      row.className = `sample-line sample-${line.role === 'caller' ? 'caller' : 'bot'}`;
      const who = document.createElement('span');
      who.className = 'sample-who';
      who.textContent = line.role === 'caller' ? 'Caller' : 'Bot';
      const text = document.createElement('span');
      text.textContent = line.text;
      row.appendChild(who);
      row.appendChild(text);
      call.appendChild(row);
    });
    return call;
  }

  function appendBubble(role, content, draft) {
    const sample = draft?.sampleConversation || state.draft?.sampleConversation || [];
    const hasMarker = typeof content === 'string' && content.includes('[[SAMPLE_CALL]]');
    const looksLikeFlatSample =
      role === 'assistant' &&
      sample.length > 0 &&
      /\bBot:\s/i.test(content) &&
      /\bCaller:\s/i.test(content);

    if (role === 'assistant' && sample.length && (hasMarker || looksLikeFlatSample)) {
      const parts = hasMarker
        ? content.split('[[SAMPLE_CALL]]')
        : content.split(/\n\n(?=Bot:)/i);

      const before = (parts[0] || '')
        .replace(/\n\nBot:[\s\S]*$/i, '')
        .replace(/\bBot:.*$/i, '')
        .trim();
      let after = '';
      if (hasMarker) {
        after = (parts[1] || '').trim();
      } else {
        // Strip flat Bot/Caller dump; keep a trailing CTA if present after Goodbye.
        const m = content.match(/Goodbye\.\s*([\s\S]*)$/i);
        after = (m?.[1] || '').trim();
        if (!after && /Help me build it/i.test(content)) {
          after =
            'If you’d like Guidify to build this with you, use Help me build it below — or say what to adjust.';
        }
      }

      if (before) {
        const intro = document.createElement('div');
        intro.className = 'bubble bubble-assistant';
        intro.textContent = before;
        chatLog.appendChild(intro);
      }

      const card = document.createElement('div');
      card.className = 'bubble bubble-assistant chat-sample';
      const title = document.createElement('div');
      title.className = 'chat-sample-title';
      title.textContent = 'Sample call';
      card.appendChild(title);
      card.appendChild(buildSampleCallEl(sample));
      chatLog.appendChild(card);

      if (after) {
        const cta = document.createElement('div');
        cta.className = 'bubble bubble-assistant';
        cta.textContent = after;
        chatLog.appendChild(cta);
      }
      chatLog.scrollTop = chatLog.scrollHeight;
      return;
    }

    const el = document.createElement('div');
    el.className = `bubble bubble-${role}`;
    el.textContent = content;
    chatLog.appendChild(el);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function renderMessages(messages, draft) {
    chatLog.replaceChildren();
    (messages || []).forEach((m) => appendBubble(m.role, m.content, draft));
  }

  function renderDraft(draft) {
    state.draft = draft;
    const nodes =
      draft?.flowNodes?.length > 0
        ? draft.flowNodes
        : [
            { id: 'greeting', label: 'Greeting', kind: 'speak' },
            { id: 'listen', label: 'Listen', kind: 'listen' },
            { id: 'end', label: 'End', kind: 'end' },
          ];

    flowPreview.replaceChildren();
    nodes.forEach((n, i) => {
      if (i > 0) {
        const arrow = document.createElement('span');
        arrow.className = 'flow-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '→';
        flowPreview.appendChild(arrow);
      }
      const node = document.createElement('span');
      node.className = 'flow-node';
      node.dataset.kind = n.kind || 'speak';
      node.setAttribute('role', 'listitem');
      node.textContent = n.label;
      flowPreview.appendChild(node);
    });

    const funnels = draft?.funnels || [];
    const events = draft?.analyticsEvents || [];
    funnelPreview.replaceChildren();
    if (funnels.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'desired empty';
      empty.textContent = 'Answer in chat to shape funnels.';
      funnelPreview.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.className = 'funnel-list';
      funnels.forEach((f) => {
        const item = document.createElement('div');
        item.className = 'funnel-item';
        const title = document.createElement('strong');
        title.textContent = f.label;
        item.appendChild(title);
        const steps = document.createElement('ul');
        steps.className = 'funnel-steps';
        (f.steps || []).forEach((s) => {
          const li = document.createElement('li');
          li.textContent = s;
          steps.appendChild(li);
        });
        item.appendChild(steps);
        const linked = events.filter((e) => e.funnelId === f.id);
        if (linked.length) {
          const ev = document.createElement('ul');
          ev.className = 'event-steps';
          linked.forEach((e) => {
            const li = document.createElement('li');
            li.innerHTML = '';
            const code = document.createElement('code');
            code.textContent = e.tag;
            li.appendChild(code);
            li.appendChild(
              document.createTextNode(
                ` → ${e.step || 'step'}${e.why ? ` — ${e.why}` : ''}`,
              ),
            );
            ev.appendChild(li);
          });
          item.appendChild(ev);
        }
        list.appendChild(item);
      });
      funnelPreview.appendChild(list);
    }

    if (samplePreview) {
      const sample = draft?.sampleConversation || [];
      if (!sample.length) {
        samplePreview.className = 'desired empty';
        samplePreview.textContent = 'Sample call appears once the flow is proposed.';
      } else {
        samplePreview.className = 'desired sample-call-wrap';
        samplePreview.replaceChildren();
        samplePreview.appendChild(buildSampleCallEl(sample));
      }
    }

    const desired = (
      draft?.desiredResult ||
      draft?.useCase ||
      draft?.refinementOffer ||
      ''
    ).trim();
    desiredPreview.className = desired ? 'desired' : 'desired empty';
    desiredPreview.textContent =
      desired || 'Success definition appears as you design.';
    const label = draft?.companyName || draft?.product;
    draftProduct.textContent = label ? String(label).slice(0, 28) : 'draft';

    const buildDock = document.querySelector('.build-dock');
    if (buildDock) {
      buildDock.classList.toggle('is-offer', Boolean(draft?.offerHelp));
    }
  }

  class RateLimitError extends Error {
    constructor(message) {
      super(message);
      this.name = 'RateLimitError';
    }
  }

  function showChat() {
    intakeForm.hidden = true;
    chatForm.hidden = false;
    chatInput.focus();
  }

  function showRateLimited(message) {
    chatLog.replaceChildren();
    appendBubble('assistant', message);
    state.messages = [{ role: 'assistant', content: message }];
    intakeForm.hidden = true;
    chatForm.hidden = false;
    chatInput.disabled = true;
    chatSend.disabled = true;
  }

  async function designIntake(payload) {
    const res = await fetch('/api/design/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: state.sessionId,
        ...payload,
      }),
    });
    if (res.status === 429) {
      let msg =
        'Conversation limit reached for today from this network. Email mpyskunov@guidify.ca, or try again tomorrow.';
      try {
        const json = await res.json();
        if (json?.message) msg = json.message;
      } catch {
        /* ignore */
      }
      throw new RateLimitError(msg);
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      throw new Error(json.error || `intake failed (${res.status})`);
    }
    return json;
  }

  async function designTurn(message) {
    const body = {
      sessionId: state.sessionId,
      messages: state.messages,
      draft: state.draft,
    };
    if (message) body.message = message;

    const res = await fetch('/api/design/turn', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      let msg =
        'Conversation limit reached for today from this network. Email mpyskunov@guidify.ca, or try again tomorrow.';
      try {
        const json = await res.json();
        if (json?.message) msg = json.message;
      } catch {
        /* ignore */
      }
      throw new RateLimitError(msg);
    }
    if (!res.ok) throw new Error(`design turn failed (${res.status})`);
    return res.json();
  }

  intakeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.busy) return;
    if (intakeError) intakeError.hidden = true;
    const companyName = document.getElementById('intake-company').value.trim();
    const contactEmail = document.getElementById('intake-email').value.trim();
    const contactName = document.getElementById('intake-name').value.trim();
    if (!companyName || !contactEmail || !contactName) {
      if (intakeError) {
        intakeError.textContent = 'Company, email, and name are required.';
        intakeError.hidden = false;
      }
      return;
    }
    if (intakeSubmit) intakeSubmit.disabled = true;
    setBusy(true, 'Saving…');
    try {
      const res = await designIntake({ companyName, contactEmail, contactName });
      if (res.completed) {
        onServerCompleted(res);
        renderMessages(res.messages || [], res.draft);
        appendBubble(
          'assistant',
          res.assistantMessage ||
            'This conversation is already closed. Refresh to start a new planner session.',
        );
        return;
      }
      state.messages = res.messages || [];
      state.active = true;
      state.completed = false;
      renderMessages(state.messages, res.draft);
      renderDraft(res.draft);
      showChat();
      bumpIdleTimer();
      // Prefill quote dialog when they later click Help me build it
      const qName = document.getElementById('q-name');
      const qEmail = document.getElementById('q-email');
      const qCompany = document.getElementById('q-company');
      if (qName && !qName.value) qName.value = contactName;
      if (qEmail && !qEmail.value) qEmail.value = contactEmail;
      if (qCompany && !qCompany.value) qCompany.value = companyName;
    } catch (err) {
      if (err instanceof RateLimitError) {
        showRateLimited(err.message);
      } else if (intakeError) {
        intakeError.textContent = err.message || 'Could not save contact details.';
        intakeError.hidden = false;
      }
    } finally {
      if (intakeSubmit) intakeSubmit.disabled = false;
      setBusy(false);
    }
  });

  function resizeChatInput() {
    chatInput.style.height = 'auto';
    chatInput.style.height = `${Math.min(chatInput.scrollHeight, 136)}px`;
  }

  chatInput.addEventListener('input', () => {
    chatSend.disabled = state.busy || !chatInput.value.trim();
    resizeChatInput();
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.shiftKey) return; // new line
    e.preventDefault();
    if (!state.busy && chatInput.value.trim()) {
      chatForm.requestSubmit();
    }
  });

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.completed) return;
    const text = chatInput.value.trim();
    if (!text || state.busy) return;
    chatInput.value = '';
    resizeChatInput();
    chatSend.disabled = true;
    appendBubble('user', text);
    setBusy(true, 'Designing…');
    bumpIdleTimer();
    try {
      const res = await designTurn(text);
      state.messages = res.messages || [];
      renderMessages(state.messages, res.draft);
      renderDraft(res.draft);
      if (res.completed) {
        onServerCompleted(res);
      } else {
        bumpIdleTimer();
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        showRateLimited(err.message);
      } else {
        appendBubble(
          'assistant',
          'Something hiccuped on my side — try that again in a moment.',
        );
      }
    } finally {
      setBusy(false);
      resizeChatInput();
    }
  });

  // Activity keeps the 30-minute idle clock alive.
  ['pointerdown', 'keydown', 'input'].forEach((evt) => {
    document.addEventListener(evt, () => bumpIdleTimer(), { passive: true });
  });

  // Leaving the site / closing the tab closes the conversation.
  // (Do not use visibilitychange — switching tabs is not "leaving".)
  window.addEventListener('pagehide', () => {
    completeSession('left_site', false);
  });

  function openQuote() {
    quoteError.hidden = true;
    quoteSuccess.hidden = true;
    quoteFields.hidden = false;
    if (quoteFooter) quoteFooter.hidden = false;
    if (quoteLead) quoteLead.hidden = false;
    if (state.draft?.contactName) {
      const qName = document.getElementById('q-name');
      if (qName && !qName.value) qName.value = state.draft.contactName;
    }
    if (state.draft?.contactEmail) {
      const qEmail = document.getElementById('q-email');
      if (qEmail && !qEmail.value) qEmail.value = state.draft.contactEmail;
    }
    if (state.draft?.companyName) {
      const qCompany = document.getElementById('q-company');
      if (qCompany && !qCompany.value) qCompany.value = state.draft.companyName;
    }
    dialog.showModal();
  }

  function closeQuote() {
    dialog.close();
  }

  document.querySelectorAll('[data-open-quote]').forEach((btn) => {
    btn.addEventListener('click', openQuote);
  });

  document.getElementById('quote-cancel').addEventListener('click', closeQuote);
  document.getElementById('quote-x').addEventListener('click', closeQuote);

  quoteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    quoteError.hidden = true;
    const name = document.getElementById('q-name').value.trim();
    const email = document.getElementById('q-email').value.trim();
    const company = document.getElementById('q-company').value.trim();
    const notes = document.getElementById('q-notes').value.trim();
    const submitBtn = document.getElementById('quote-submit');
    submitBtn.disabled = true;
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId,
          name,
          email,
          company,
          notes,
          // Always attach planner draft — never ask the visitor.
          designDraft: state.draft,
          messages: state.messages,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        quoteError.textContent = json.error || 'Could not submit';
        quoteError.hidden = false;
        return;
      }
      quoteSuccess.textContent =
        json.message ||
        'Thanks — Guidify is the only official team for Vapi Studio. We will follow up with a quote shortly.';
      quoteSuccess.hidden = false;
      quoteFields.hidden = true;
      if (quoteLead) quoteLead.hidden = true;
      if (quoteFooter) quoteFooter.hidden = true;
      state.completed = true;
      state.active = false;
      clearIdleTimer();
      localStorage.setItem(SESSION_KEY, crypto.randomUUID());
    } catch {
      quoteError.textContent = 'Network error — try again';
      quoteError.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Optional live star refresh; falls back to hardcoded data-stars.
  (async () => {
    const el = document.getElementById('gh-stars');
    if (!el) return;
    try {
      const res = await fetch('https://api.github.com/repos/guidify-ai/vapi-studio');
      if (!res.ok) return;
      const json = await res.json();
      if (typeof json.stargazers_count === 'number') {
        el.textContent = String(json.stargazers_count);
      }
    } catch {
      /* keep hardcoded */
    }
  })();

  // Focus intake when landing on planner CTA.
  const focusIntake = () => {
    const el = document.getElementById('intake-company');
    if (el && !intakeForm.hidden) setTimeout(() => el.focus(), 200);
  };
  if (location.hash === '#studio-planner') focusIntake();
  document.querySelectorAll('a[href="#studio-planner"]').forEach((a) => {
    a.addEventListener('click', focusIntake);
  });
})();
