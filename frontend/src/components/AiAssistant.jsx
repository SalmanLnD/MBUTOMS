import { useEffect, useRef, useState } from 'react';
import { sendAiMessage } from '../services/aiService.js';
import { isAbortError } from '../services/api.js';
import { AI_SUGGESTED_QUESTIONS } from '../utils/aiAssistantAccess.js';
import SalluAvatar from './SalluAvatar.jsx';
import '../styles/ai-assistant.css';

const AiAssistant = ({ open, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef(null);
  const end = useRef(null);
  const panel = useRef(null);
  const request = useRef(null);
  const lastQuestion = useRef('');

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (open) requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
  }, [open]);
  useEffect(() => { if (open) end.current?.scrollIntoView({ block: 'nearest' }); }, [open, messages, busy, error]);
  useEffect(() => {
    if (!open) return undefined;
    const viewport = window.visualViewport;
    const fit = () => {
      panel.current?.style.setProperty('--assistant-height', `${viewport?.height || window.innerHeight}px`);
      panel.current?.style.setProperty('--assistant-bottom', `${Math.max(0, window.innerHeight - ((viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight)))}px`);
    };
    fit(); viewport?.addEventListener('resize', fit); viewport?.addEventListener('scroll', fit);
    return () => { viewport?.removeEventListener('resize', fit); viewport?.removeEventListener('scroll', fit); };
  }, [open]);

  const send = async (question, retry = false) => {
    const text = question.trim();
    if (!text || busy || text.length > 2000) return;
    lastQuestion.current = text;
    setError(''); setBusy(true); setDraft('');
    if (!retry) setMessages((current) => [...current.slice(-39), { role: 'user', text }]);
    const controller = new AbortController(); request.current = controller;
    try {
      const data = await sendAiMessage(text, controller.signal);
      if (!controller.signal.aborted) setMessages((current) => [...current.slice(-39), { role: 'assistant', text: data.message || 'No answer was returned. Please try again.' }]);
    } catch (failure) {
      if (!isAbortError(failure)) setError(failure.response?.status === 429
        ? 'The assistant is busy. Wait a moment, then retry.'
        : failure.response?.status === 403 ? 'Your account no longer has access to this assistant.'
          : 'Could not get an answer. Please try again.');
    } finally {
      if (!controller.signal.aborted) { setBusy(false); request.current = null; }
    }
  };

  return (
    <section ref={panel} hidden={!open} className="ai-assistant" role="dialog" aria-modal="false"
      aria-labelledby="ai-assistant-title" onKeyDown={(event) => {
        if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      }}>
      <header className="ai-assistant__header">
        <div className="ai-assistant__identity"><SalluAvatar size={40} /><div><h2 id="ai-assistant-title">Sallu</h2><p>Your TOMS assistant · Read-only</p></div></div>
        <button type="button" className="ai-assistant__close" onClick={onClose} aria-label="Close Sallu">×</button>
      </header>
      <div className="ai-assistant__messages" role="log" aria-label="Assistant conversation" aria-live="polite" aria-relevant="additions text">
        {!messages.length && <div className="ai-assistant__welcome">
          <h3>Hi, I’m Sallu.</h3><p>Ask about schedules, replacements, hours or topic tracking.</p>
          <div className="ai-assistant__suggestions">
            {AI_SUGGESTED_QUESTIONS.map((question) => <button key={question} type="button" disabled={busy} onClick={() => send(question)}>{question}<span aria-hidden="true">↗</span></button>)}
          </div>
        </div>}
        {messages.map((message, index) => <article key={index} className={`ai-assistant__message ai-assistant__message--${message.role}`}>
          <span>{message.role === 'user' ? 'You' : <><SalluAvatar size={22} />Sallu</>}</span><p>{message.text}</p>
        </article>)}
        {busy && <p className="ai-assistant__status" role="status">Checking TOMS data…</p>}
        {error && <div className="ai-assistant__error" role="alert"><p>{error}</p><button type="button" onClick={() => send(lastQuestion.current, true)}>Retry</button></div>}
        <div ref={end} />
      </div>
      <form className="ai-assistant__composer" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
        <label className="visually-hidden" htmlFor="ai-assistant-question">Ask Sallu</label>
        <div className="ai-assistant__input-row">
          <textarea id="ai-assistant-question" ref={input} rows={2} maxLength={2000} value={draft}
            onChange={(event) => setDraft(event.target.value)} placeholder="Ask Sallu about TOMS…" disabled={busy}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(draft); }
            }} />
          <button type="submit" disabled={busy || !draft.trim()} aria-label="Send question">Send</button>
        </div>
        <p>Each question is independent. Verify important details in TOMS.</p>
      </form>
    </section>
  );
};
export default AiAssistant;
