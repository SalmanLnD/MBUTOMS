import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import '../styles/sallu-pet.css';
import { spriteFrameStyle } from '../utils/salluSpriteStyle.js';
import { cursorPose, nextPunchReaction, punchReactions, playPunchSound, playEmotionSound, reactionDialogue, recentPunches, isStomachSwipe } from '../utils/salluPetBehavior.js';

const stored = (key) => { try { return localStorage.getItem(key) === 'true'; } catch { return false; } };
const persist = (key, value) => { try { localStorage.setItem(key, String(value)); } catch {} };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const SalluPet = ({ open, onOpen, visible, onVisibilityChange }) => {
  const mobile = useMediaQuery('(max-width: 767.98px)');
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const size = mobile ? 96 : 144;
  const hidden = !visible;
  const [nodding, setNodding] = useState(false);
  const [muted, setMuted] = useState(() => stored('toms_sallu_pet_muted'));
  const audio = useRef(null);
  const lastEmotionSound = useRef({});
  const [soundStatus, setSoundStatus] = useState('ready');
  const reactionBag = useRef([]);
  const lastReaction = useRef(-1);
  const punchHistory = useRef([]);
  const lastDialogues = useRef({});
  const hoverStroke = useRef(null);
  const lastTickle = useRef(-Infinity);
  const [reactionSerial, setReactionSerial] = useState(0);
  const [reaction, setReaction] = useState(0);
  const [paused, setPaused] = useState(() => stored('toms_sallu_pet_paused'));
  const [position, setPosition] = useState({ x: Math.max(12, window.innerWidth - size - (mobile ? 12 : 24)), y: mobile ? 78 : 20 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const [pose, setPose] = useState('front');
  const [walking, setWalking] = useState(false);
  const [workingOut, setWorkingOut] = useState(false);
  const lastInteraction = useRef(Date.now());
  const workoutRef = useRef(false);
  const workoutUntil = useRef(0);
  const interact = () => { lastInteraction.current = Date.now(); workoutRef.current = false; setWorkingOut(false); };
  const [direction, setDirection] = useState('right');
  const [bubble, setBubble] = useState('');
  const [menu, setMenu] = useState(false);
  const [menuWasWalking, setMenuWasWalking] = useState(false);
  const hoverStoppedWalk = useRef(false);
  const [roamRequest, setRoamRequest] = useState(0);
  const handledRoamRequest = useRef(0);
  const menuCloseTimer = useRef(null);
  const pet = useRef(null);
  const positionRef = useRef(position);
  const reacting = useRef(false);
  const walkingRef = useRef(false);
  const reactionTimer = useRef(null);
  const bubbleTimer = useRef(null);
  const walkTimer = useRef(null);
  positionRef.current = position;

  useEffect(() => {
    if (open || hidden || reducedMotion || menu || dragging) { interact(); return undefined; }
    const timer = setInterval(() => {
      if (document.hidden || document.querySelector('[aria-modal="true"]')) { interact(); return; }
      if (workoutRef.current) { if (Date.now() >= workoutUntil.current) interact(); return; }
      if (Date.now() - lastInteraction.current < 5000 || reacting.current || walkingRef.current || drag.current) return;
      workoutRef.current = true; workoutUntil.current = Date.now() + 12000;
      setPose('front'); setNodding(false); setWorkingOut(true);
    }, 200);
    return () => clearInterval(timer);
  }, [open, hidden, reducedMotion, menu, dragging]);

  useEffect(() => {
    ['/images/sallu/reactions-atlas.png', '/images/sallu/gaze-atlas.png'].forEach(src => { const image = new Image(); image.src = src; });
  }, []);
  useEffect(() => () => {
    clearTimeout(reactionTimer.current); clearTimeout(bubbleTimer.current); clearTimeout(walkTimer.current);
    clearTimeout(menuCloseTimer.current);
    audio.current?.close().catch(() => {});
  }, []);
  useEffect(() => {
    if (!open && !hidden) return;
    clearTimeout(reactionTimer.current); clearTimeout(bubbleTimer.current);
    reacting.current = false; punchHistory.current = []; hoverStroke.current = null; drag.current = null;
    setDragging(false); setNodding(false); setPose('front'); setBubble('');
  }, [open, hidden]);
  useEffect(() => {
    const fit = () => {
      setPosition(current => ({ x: clamp(current.x, 8, Math.max(8, window.innerWidth - size - 8)), y: clamp(current.y, 12, Math.max(12, window.innerHeight - size - 12)) }));
      setWalking(false); walkingRef.current = false;
    };
    fit(); window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [size]);
  useEffect(() => {
    if (open || hidden || mobile || reducedMotion) return undefined;
    let last = 0;
    const look = (event) => {
      if (Date.now() - last < 100 || reacting.current || workoutRef.current || walkingRef.current || pet.current?.matches(':hover') || document.hidden) return;
      last = Date.now();
      const rect = pet.current?.getBoundingClientRect(); if (!rect) return;
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height * .28);
      setPose(cursorPose(dx, dy));
    };
    window.addEventListener('pointermove', look, { passive: true });
    return () => window.removeEventListener('pointermove', look);
  }, [open, hidden, mobile, reducedMotion]);
  useEffect(() => {
    if (open || hidden || paused || (mobile && !roamRequest) || reducedMotion || menu) {
      clearTimeout(walkTimer.current); walkingRef.current = false; setWalking(false); return undefined;
    }
    let roamTimer;
    const walk = (requested = false) => {
      if (document.hidden || drag.current || (!requested && pet.current?.matches(':hover, :focus-within')) || reacting.current || workoutRef.current || document.querySelector('[aria-modal="true"]')) return;
      const current = positionRef.current;
      const minX = mobile ? 8 : Math.min(248, Math.max(8, window.innerWidth - size - 8));
      const maxX = Math.max(minX, window.innerWidth - size - 12);
      const distance = 100 + Math.random() * 220;
      let nextX = clamp(current.x + (Math.random() > .5 ? 1 : -1) * distance, minX, maxX);
      if (Math.abs(nextX - current.x) <= 12) nextX = clamp(current.x + (current.x < (minX + maxX) / 2 ? distance : -distance), minX, maxX);
      const nextY = clamp(20 + Math.random() * 100, 12, Math.max(12, window.innerHeight - size - 100));
      if (Math.abs(nextX - current.x) > 12) {
        setPose('front');
        setDirection(nextX < current.x ? 'left' : 'right'); setWalking(true); walkingRef.current = true;
        setPosition({ x: nextX, y: nextY });
        walkTimer.current = setTimeout(() => { setWalking(false); walkingRef.current = false; setPose('front'); }, 4000);
      }
    };
    if (roamRequest !== handledRoamRequest.current) { handledRoamRequest.current = roamRequest; walk(true); }
    const plan = () => {
      roamTimer = setTimeout(() => { walk(); plan(); }, 20000 + Math.random() * 15000);
    };
    plan();
    const stopWhenHidden = () => {
      if (document.hidden) { clearTimeout(walkTimer.current); walkingRef.current = false; setWalking(false); }
    };
    document.addEventListener('visibilitychange', stopWhenHidden);
    return () => { clearTimeout(roamTimer); clearTimeout(walkTimer.current); document.removeEventListener('visibilitychange', stopWhenHidden); };
  }, [open, hidden, paused, mobile, reducedMotion, menu, size, roamRequest]);

  const stop = () => {
    if (walkingRef.current && pet.current) {
      const rect = pet.current.getBoundingClientRect();
      setPosition({ x: rect.left, y: window.innerHeight - rect.bottom });
    }
    clearTimeout(walkTimer.current); setWalking(false); walkingRef.current = false;
  };
  const startDrag = event => {
    if (!event.isPrimary || event.button !== 0) return;
    const rect = pet.current.getBoundingClientRect();
    stop(); suppressClick.current = false;
    hoverStroke.current = null;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, bottom: window.innerHeight - rect.bottom, started: Date.now(), body: event.currentTarget.classList.contains('sallu-pet__body'), moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = event => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    if (!current.moved && Math.hypot(dx, dy) < 6) return;
    if (!current.moved && current.body && isStomachSwipe(dx, dy, Date.now() - current.started, size)) {
      current.swiping = true; suppressClick.current = true; return;
    }
    // Wait for enough horizontal travel to distinguish a tickle from a drag.
    if (!current.moved && current.body && Date.now() - current.started <= 260
      && Math.abs(dx) > Math.abs(dy) * 1.6 && Math.abs(dy) <= size * .18) return;
    current.moved = true; suppressClick.current = true; setDragging(true);
    clearTimeout(reactionTimer.current); clearTimeout(bubbleTimer.current);
    reacting.current = false; setNodding(false); setPose('front'); setBubble(''); setMenu(false);
    setPosition({ x: clamp(current.left + dx, 8, Math.max(8, window.innerWidth - size - 8)), y: clamp(current.bottom - dy, 12, Math.max(12, window.innerHeight - size - 12)) });
  };
  const endDrag = event => {
    const current = drag.current;
    if (current?.id !== event.pointerId) return;
    if (event.type === 'pointerup' && !current.moved && current.body
      && !isStomachSwipe(event.clientX - current.x, event.clientY - current.y, Date.now() - current.started, size)) moveDrag(event);
    if (event.type === 'pointerup' && !current.moved && current.body
      && isStomachSwipe(event.clientX - current.x, event.clientY - current.y, Date.now() - current.started, size)) {
      suppressClick.current = true; tickle();
    } else if (!current.moved && current.swiping) suppressClick.current = true;
    drag.current = null; setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const dragEvents = { onPointerDown: startDrag, onPointerMove: moveDrag, onPointerUp: endDrag, onPointerCancel: endDrag, onLostPointerCapture: endDrag };
  const clickPet = (event, action) => {
    if (event.detail !== 0 && suppressClick.current) { suppressClick.current = false; event.preventDefault(); return; }
    interact();
    action(event);
  };
  useEffect(() => {
    if (open || hidden || reducedMotion) return undefined;
    const approve = event => {
      if (!(event.target instanceof Element) || event.target.closest('.sallu-pet, .sallu-pet-return, .sidebar-assistant, [role="dialog"]') || reacting.current) return;
      if (!event.target.closest('button, a, input, select, [role="button"], [tabindex="0"]')) return;
      workoutRef.current = false; setWorkingOut(false); lastInteraction.current = Date.now();
      stop(); reacting.current = true; setPose('front'); setNodding(true);
      reactionTimer.current = setTimeout(() => { reacting.current = false; setNodding(false); }, 900);
    };
    // Inspect the target before a pet menu action unmounts that target. In
    // bubble phase its detached button could be mistaken for a page action.
    document.addEventListener('click', approve, true);
    return () => document.removeEventListener('click', approve, true);
  }, [open, hidden, reducedMotion]);
  const reactionSound = async (emotion = 'punch') => {
    if (muted) { setSoundStatus('muted'); return; }
    if (emotion !== 'punch') {
      const now = Date.now(), gap = emotion === 'crying' ? 3000 : 1700;
      if (now - (lastEmotionSound.current[emotion] ?? -Infinity) < gap) return;
      lastEmotionSound.current[emotion] = now;
    }
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Audio unavailable');
      if (!audio.current || audio.current.state === 'closed') audio.current = new Audio();
      if (emotion === 'punch') await playPunchSound(audio.current);
      else await playEmotionSound(audio.current, emotion);
      setSoundStatus('playing');
    } catch { setSoundStatus('blocked'); }
  };
  const showReaction = (nextPose, expression, duration) => {
    stop(); clearTimeout(reactionTimer.current); clearTimeout(bubbleTimer.current);
    const line = reactionDialogue(expression, lastDialogues.current[expression]);
    lastDialogues.current[expression] = line;
    setNodding(false); reacting.current = true; setPose(nextPose); setBubble(line);
    setReactionSerial(current => current + 1);
    reactionTimer.current = setTimeout(() => { reacting.current = false; setPose('front'); }, duration);
    bubbleTimer.current = setTimeout(() => setBubble(''), duration + 600);
  };
  const tickle = () => {
    if (Date.now() - lastTickle.current < 450) return;
    lastTickle.current = Date.now(); punchHistory.current = [];
    showReaction('laughing', 'laughing', 1800);
    void reactionSound('laughing');
  };
  const hoverTickle = event => {
    if (drag.current || event.pointerType !== 'mouse' || event.buttons) return;
    const now = Date.now(), previous = hoverStroke.current;
    if (!previous || now - previous.time > 260) { hoverStroke.current = { x: event.clientX, y: event.clientY, time: now }; return; }
    if (isStomachSwipe(event.clientX - previous.x, event.clientY - previous.y, now - previous.time, size)) {
      hoverStroke.current = null; tickle();
    }
  };
  const react = () => {
    punchHistory.current = recentPunches(punchHistory.current, Date.now());
    void reactionSound();
    if (punchHistory.current.length >= 4) { showReaction('crying', 'crying', 3200); void reactionSound('crying'); return; }
    const next = nextPunchReaction(reactionBag.current, lastReaction.current);
    lastReaction.current = next; setReaction(next);
    showReaction('ouch', punchReactions[next], 1600);
  };
  const chat = (event) => { stop(); setBubble(''); setMenu(false); onOpen(event); };
  const hide = () => { stop(); onVisibilityChange(false); setMenu(false); };
  const cancelMenuClose = () => clearTimeout(menuCloseTimer.current);
  const scheduleMenuClose = event => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    cancelMenuClose();
    menuCloseTimer.current = setTimeout(() => {
      if (!pet.current?.querySelector('.sallu-pet__menu')?.matches(':hover')) setMenu(false);
    }, 1000);
  };
  useEffect(() => { if (!menu || open || hidden) cancelMenuClose(); }, [menu, open, hidden]);
  const toggleRoaming = () => {
    cancelMenuClose(); stop();
    if (walking || menuWasWalking) {
      hoverStoppedWalk.current = false;
      setPaused(true); persist('toms_sallu_pet_paused', true); setMenuWasWalking(false);
    } else {
      clearTimeout(reactionTimer.current); reacting.current = false; setNodding(false); setPose('front');
      setPaused(false); persist('toms_sallu_pet_paused', false); setMenu(false); setRoamRequest(current => current + 1);
    }
  };

  if (hidden) return mobile && !open && <button className="sallu-pet-return btn btn-sm btn-outline-primary" onClick={() => onVisibilityChange(true)} aria-label="Show Sallu pet">Sallu</button>;
  return <div ref={pet} className={`sallu-pet ${walking ? 'is-walking' : ''} ${workingOut ? 'is-working-out' : ''} ${pose === 'ouch' ? 'is-ouch' : ''} ${nodding ? 'is-nodding' : ''} ${dragging ? 'is-dragging' : ''}`}
    hidden={open} data-pose={pose} data-direction={direction} data-reaction={pose === 'ouch' ? punchReactions[reaction] : ['laughing', 'crying'].includes(pose) ? pose : undefined} data-sound={muted ? 'muted' : soundStatus}
    style={{ '--pet-size': `${size}px`, left: position.x, bottom: position.y }}
    onPointerMoveCapture={interact}
    onPointerDownCapture={interact}
    onFocusCapture={interact}
    onKeyDownCapture={event => { interact(); if (event.key === 'Escape') setMenu(false); }}
    onPointerEnter={event => { interact(); hoverStoppedWalk.current = walkingRef.current; if (event.target.closest('.sallu-pet__settings, .sallu-pet__menu')) return; stop(); if (!reacting.current) setPose('front'); }}
    onPointerLeave={() => { if (!menu) hoverStoppedWalk.current = false; }}
    >
    <div className="sallu-pet__bubble" role="status" aria-live="polite"
      style={{ left: clamp(size / 2, 108 - position.x, window.innerWidth - 108 - position.x),
        ...(window.innerHeight - position.y - size < 90 ? { top: '100%', bottom: 'auto' } : {}) }}>{bubble}</div>
    {workingOut && <div className="sallu-pet__workout-label" role="status">Treadmill time!</div>}
    {workingOut && <div className="sallu-pet__treadmill" aria-hidden="true"><span className="sallu-pet__treadmill-belt" /><span className="sallu-pet__treadmill-post" /><span className="sallu-pet__treadmill-console"><i /></span></div>}
    <div key={['ouch', 'crying'].includes(pose) ? `reaction-${reactionSerial}` : pose} className={`sallu-pet__sprite sallu-pet__sprite--${pose} ${pose.startsWith('gaze-') ? 'sallu-pet__sprite--gaze' : ''}`} aria-hidden="true">
      {(pose === 'ouch' || pose.startsWith('gaze-') || pose === 'laughing' || pose === 'crying') && <span style={spriteFrameStyle(pose.startsWith('gaze-') ? 'gaze' : 'reactions', pose === 'laughing' ? 9 : pose === 'crying' ? 12 : pose === 'ouch' ? reaction : Number(pose.slice(5)), size)} />}
      {pose === 'crying' && <span className="sallu-pet__tears"><i /><i /></span>}
    </div>
    <div className="sallu-pet__nod-head sallu-pet__sprite" aria-hidden="true" />
    <button type="button" className="sallu-pet__hit sallu-pet__face" {...dragEvents} onClick={event => clickPet(event, chat)} aria-label="Chat with Sallu" title="Click to chat; drag to move" />
    <button type="button" className="sallu-pet__hit sallu-pet__body" {...dragEvents}
      onPointerMove={event => { moveDrag(event); hoverTickle(event); }} onPointerLeave={() => { hoverStroke.current = null; }}
      onClick={event => clickPet(event, react)} aria-label="Poke Sallu" title="Click to poke; swipe belly to tickle; hold and drag to move" />
    <button type="button" className="sallu-pet__settings" aria-label="Sallu pet options" aria-expanded={menu} onPointerEnter={cancelMenuClose} onPointerLeave={scheduleMenuClose} onClick={() => { cancelMenuClose(); setMenuWasWalking(walkingRef.current || hoverStoppedWalk.current); stop(); setMenu(!menu); }}>⋯</button>
    {menu && <div className="sallu-pet__menu" onPointerEnter={cancelMenuClose} onPointerLeave={scheduleMenuClose} onFocus={cancelMenuClose}>
      {soundStatus === 'blocked' && !muted && <span className="sallu-pet__audio-status" role="status">Sound is blocked. Check this tab’s audio permission.</span>}
      <button type="button" onClick={chat}>Talk to Sallu</button>
      <button type="button" onClick={toggleRoaming} disabled={reducedMotion} title={reducedMotion ? 'Roaming is disabled by your reduced motion preference' : undefined}>{walking || menuWasWalking ? 'Pause roaming' : 'Start roaming'}</button>
      <button type="button" onClick={() => setMuted(current => { persist('toms_sallu_pet_muted', !current); return !current; })}>{muted ? 'Enable reaction sound' : 'Mute reaction sound'}</button>
      <button type="button" onClick={hide}>Hide Sallu</button>
      <button type="button" onClick={() => setMenu(false)}>Close</button>
    </div>}
  </div>;
};
export default SalluPet;
