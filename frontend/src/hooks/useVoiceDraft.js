import { useEffect, useRef, useState } from 'react';

export const useVoiceDraft = ({ draft, setDraft, enabled, input }) => {
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('');
  const session = useRef(null);
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = Boolean(Recognition && window.isSecureContext);

  const cancel = () => {
    const current = session.current;
    session.current = null;
    if (!current) return;
    clearTimeout(current.timer);
    current.recognition.onresult = null;
    current.recognition.onerror = null;
    current.recognition.onend = null;
    current.recognition.abort();
  };
  useEffect(() => {
    if (!enabled) { cancel(); setListening(false); setStatus(''); }
    return cancel;
  }, [enabled]);

  const toggle = () => {
    if (session.current) {
      session.current.recognition.stop();
      setStatus('Finishing transcription…');
      return;
    }
    if (!enabled || !supported) return;
    const recognition = new Recognition();
    const current = { recognition, timer: null };
    const prefix = draft.trimEnd();
    let received = false;
    let failed = false;
    recognition.lang = 'en-IN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = event => {
      if (session.current !== current) return;
      const transcript = Array.from(event.results, result => result[0].transcript).join(' ').trim();
      if (!transcript) return;
      received = true;
      const combined = [prefix, transcript].filter(Boolean).join(' ');
      setDraft(combined.slice(0, 2000));
      if (combined.length >= 2000) { recognition.stop(); setStatus('Character limit reached. Review your draft.'); }
    };
    recognition.onerror = event => {
      if (session.current !== current) return;
      failed = true;
      setStatus({
        'not-allowed': 'Microphone access was denied. Allow it in browser settings or type your question.',
        'service-not-allowed': 'Speech recognition is unavailable in this browser. Type your question instead.',
        'audio-capture': 'No microphone found. Connect a microphone and try again.',
        'no-speech': 'No speech detected. Try again or type your question.',
        network: 'Transcription could not connect. Check your connection and try again.',
      }[event.error] || 'Voice input stopped. You can edit or type your question.');
    };
    recognition.onend = () => {
      if (session.current !== current) return;
      clearTimeout(current.timer);
      session.current = null;
      setListening(false);
      if (!failed) setStatus(received ? 'Review or edit your transcription, then press Send.' : 'No speech detected. Try again or type your question.');
      input.current?.focus({ preventScroll: true });
    };
    session.current = current;
    setListening(true);
    setStatus('Listening… Press Stop when finished.');
    try {
      recognition.start();
      current.timer = setTimeout(() => { if (session.current === current) recognition.stop(); }, 60000);
    } catch {
      cancel(); setListening(false);
      setStatus('Could not start voice input. Try again or type your question.');
    }
  };
  return { listening, status, supported, toggle };
};
