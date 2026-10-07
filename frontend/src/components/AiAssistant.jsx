import { useEffect, useRef, useState } from 'react';
import { sendAiMessage } from '../services/aiService.js';
import { isAbortError } from '../services/api.js';
import { AI_SUGGESTED_QUESTIONS } from '../utils/aiAssistantAccess.js';
import SalluAvatar from './SalluAvatar.jsx';
import { SALLU_LOADING_MESSAGES } from '../utils/salluLoadingMessages.js';
import '../styles/ai-assistant.css';
import { useVoiceDraft } from '../hooks/useVoiceDraft.js';

const AiAssistant = ({ open, onClose, usage, usageError, refreshUsage }) => {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const input = useRef(null);
  const end = useRef(null);
  const panel = useRef(null);
  const request = useRef(null);
  const lastQuestion = useRef('');
  const unavailable = !usage || usageError || !usage.configured || usage.sharedExhausted || (!usage.unlimitedPersonal && usage.remaining <= 0);
  const voice = useVoiceDraft({ draft, setDraft, enabled: open && !busy && !unavailable, input });

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!busy || !open) return undefined;
    const timer = setInterval(() => setLoadingIndex((index) => (index + 1) % SALLU_LOADING_MESSAGES.length), 3000);
    return () => clearInterval(timer);
  }, [busy, open]);
  useEffect(() => {
    if (!speaking) return undefined;
    const timer = setTimeout(() => setSpeaking(false), 1000);
    return () => clearTimeout(timer);
  }, [speaking]);
  useEffect(() => {
    if (open) requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
    if (open) refreshUsage();
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
    if (!text || busy || unavailable || voice.listening || text.length > 2000) return;
    lastQuestion.current = text;
    setError(''); setBusy(true); setDraft(''); setSpeaking(false);
    setLoadingIndex(Math.floor(Math.random() * SALLU_LOADING_MESSAGES.length));
    if (!retry) setMessages((current) => [...current.slice(-39), { role: 'user', text }]);
    const controller = new AbortController(); request.current = controller;
    try {
      const data = await sendAiMessage(text, controller.signal);
      if (!controller.signal.aborted) {
        setMessages((current) => [...current.slice(-39), { role: 'assistant', text: data.message || 'No answer was returned. Please try again.' }]);
        setSpeaking(true);
      }
    } catch (failure) {
      if (!isAbortError(failure)) setError(failure.response?.data?.code?.startsWith('AI_') ? failure.response.data.message : failure.response?.status === 429
        ? 'The assistant is busy. Wait a moment, then retry.'
        : failure.response?.status === 403 ? 'Your account no longer has access to this assistant.'
          : failure.response?.status === 503 ? 'Sallu is temporarily unavailable. Please try again shortly.' : 'Could not get an answer. Please try again.');
    } finally {
      if (!controller.signal.aborted) { setBusy(false); request.current = null; }
      refreshUsage();
    }
  };

  return (
    <section ref={panel} hidden={!open} className="ai-assistant" role="dialog" aria-modal="false"
      aria-labelledby="ai-assistant-title" onKeyDown={(event) => {
        if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      }}>
      <header className="ai-assistant__header">
        <div className="ai-assistant__identity"><SalluAvatar size={40} state={open && busy ? 'thinking' : open && speaking ? 'speaking' : 'idle'} /><div><h2 id="ai-assistant-title">Sallu</h2><p>Your TOMS assistant · Read-only</p></div></div>
        <button type="button" className="ai-assistant__close" onClick={onClose} aria-label="Close Sallu">×</button>
      </header>
      <div className="ai-assistant__messages" role="log" aria-label="Assistant conversation" aria-live="polite" aria-relevant="additions text">
        {!messages.length && <div className="ai-assistant__welcome">
          <h3>Hi, I’m Sallu.</h3><p>Ask about schedules, replacements, hours or topic tracking.</p>
          <div className="ai-assistant__suggestions">
            {AI_SUGGESTED_QUESTIONS.map((question) => <button key={question} type="button" disabled={busy || unavailable || voice.listening} onClick={() => send(question)}>{question}<span aria-hidden="true">↗</span></button>)}
          </div>
        </div>}
        {messages.map((message, index) => <article key={index} className={`ai-assistant__message ai-assistant__message--${message.role}`}>
          <span>{message.role === 'user' ? 'You' : <><SalluAvatar size={22} state={open && speaking && index === messages.length - 1 ? 'speaking' : 'idle'} />Sallu</>}</span><p>{message.text}</p>
        </article>)}
        {busy && <p className="ai-assistant__status" role="status"><SalluAvatar size={32} state={open ? 'thinking' : 'idle'} /><span>{SALLU_LOADING_MESSAGES[loadingIndex]}</span></p>}
        {error && <div className="ai-assistant__error" role="alert"><p>{error}</p><button type="button" disabled={busy || unavailable} onClick={() => send(lastQuestion.current, true)}>Retry</button></div>}
        <div ref={end} />
      </div>
      <form className="ai-assistant__composer" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
        <div className="ai-assistant__quota" aria-live="polite">
          {usageError ? <>Usage unavailable. <button type="button" onClick={() => refreshUsage()}>Refresh</button></>
            : !usage ? 'Loading your allowance…' : !usage.configured ? 'Sallu is paused until the free API quotas are configured.'
              : usage.sharedExhausted ? <>The shared free API budget is exhausted.<small>Resets {new Date(usage.resetAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST</small></>
              : <>{usage.unlimitedPersonal ? null : `${usage.remaining} of ${usage.questionsPerDay} questions left today / ${usage.questionsPerMinute} per minute`}
                <small>Resets {new Date(usage.resetAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST</small>
                {usage.sharedRemaining !== undefined && <small>Shared Gemini budget: {usage.sharedRemaining}/{usage.providerCallsPerDay} calls left</small>}</>}
        </div>
        <label className="visually-hidden" htmlFor="ai-assistant-question">Ask Sallu</label>
        <div className="ai-assistant__input-row">
          <textarea id="ai-assistant-question" ref={input} rows={2} maxLength={2000} value={draft}
            onChange={(event) => setDraft(event.target.value)} placeholder="Ask Sallu about TOMS…" disabled={busy || unavailable} readOnly={voice.listening}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(draft); }
            }} />
          <button type="button" className="ai-assistant__mic" disabled={busy || unavailable || !voice.supported}
            onClick={voice.toggle} aria-pressed={voice.listening} aria-label={voice.listening ? 'Stop voice input' : 'Start voice input'}
            title={voice.supported ? 'Dictate your question in English' : 'Voice input is unavailable in this browser'}>
            {voice.listening ? 'Stop' : <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></svg>}
          </button>
          <button type="submit" disabled={busy || unavailable || voice.listening || !draft.trim()} aria-label="Send question">Send</button>
        </div>
        <p className="ai-assistant__voice-status" role="status">{voice.status || (voice.supported ? 'Use the mic to dictate. Review your text before sending.' : 'Voice input is unavailable in this browser. You can type your question.')}</p>
        <p>Each question is independent. Verify important details in TOMS.</p>
      </form>
    </section>
  );
};
export default AiAssistant;
