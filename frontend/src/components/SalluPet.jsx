import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import '../styles/sallu-pet.css';
import { spriteFrameStyle } from '../utils/salluSpriteStyle.js';
import { cursorPose, nextPunchReaction, punchReactions, playPunchSound } from '../utils/salluPetBehavior.js';

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
  const [soundStatus, setSoundStatus] = useState('ready');
  const reactionBag = useRef([]);
  const lastReaction = useRef(-1);
  const [reaction, setReaction] = useState(0);
  const [paused, setPaused] = useState(() => stored('toms_sallu_pet_paused'));
  const [position, setPosition] = useState({ x: Math.max(12, window.innerWidth - size - (mobile ? 12 : 24)), y: mobile ? 78 : 20 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const [pose, setPose] = useState('front');
  const [walking, setWalking] = useState(false);
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
    ['/images/sallu/reactions-atlas.png', '/images/sallu/gaze-atlas.png'].forEach(src => { const image = new Image(); image.src = src; });
  }, []);
  useEffect(() => () => {
    clearTimeout(reactionTimer.current); clearTimeout(bubbleTimer.current); clearTimeout(walkTimer.current);
    clearTimeout(menuCloseTimer.current);
    audio.current?.close().catch(() => {});
  }, []);
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
      if (Date.now() - last < 100 || reacting.current || walkingRef.current || pet.current?.matches(':hover') || document.hidden) return;
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
      if (document.hidden || drag.current || (!requested && pet.current?.matches(':hover, :focus-within')) || reacting.current || document.querySelector('[aria-modal="true"]')) return;
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
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, bottom: window.innerHeight - rect.bottom, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = event => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    if (!current.moved && Math.hypot(dx, dy) < 6) return;
    current.moved = true; suppressClick.current = true; setDragging(true);
    clearTimeout(reactionTimer.current); clearTimeout(bubbleTimer.current);
    reacting.current = false; setNodding(false); setPose('front'); setBubble(''); setMenu(false);
    setPosition({ x: clamp(current.left + dx, 8, Math.max(8, window.innerWidth - size - 8)), y: clamp(current.bottom - dy, 12, Math.max(12, window.innerHeight - size - 12)) });
  };
  const endDrag = event => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null; setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const dragEvents = { onPointerDown: startDrag, onPointerMove: moveDrag, onPointerUp: endDrag, onPointerCancel: endDrag, onLostPointerCapture: endDrag };
  const clickPet = (event, action) => {
    if (event.detail !== 0 && suppressClick.current) { suppressClick.current = false; event.preventDefault(); return; }
    action(event);
  };
  useEffect(() => {
    if (open || hidden || reducedMotion) return undefined;
    const approve = event => {
      if (!(event.target instanceof Element) || event.target.closest('.sallu-pet, .sallu-pet-return, .sidebar-assistant, [role="dialog"]') || reacting.current) return;
      if (!event.target.closest('button, a, input, select, [role="button"], [tabindex="0"]')) return;
      stop(); reacting.current = true; setPose('front'); setNodding(true);
      reactionTimer.current = setTimeout(() => { reacting.current = false; setNodding(false); }, 900);
    };
    // Inspect the target before a pet menu action unmounts that target. In
    // bubble phase its detached button could be mistaken for a page action.
    document.addEventListener('click', approve, true);
    return () => document.removeEventListener('click', approve, true);
  }, [open, hidden, reducedMotion]);
  const punchSound = async () => {
    if (muted) { setSoundStatus('muted'); return; }
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Audio unavailable');
      if (!audio.current || audio.current.state === 'closed') audio.current = new Audio();
      await playPunchSound(audio.current);
      setSoundStatus('playing');
    } catch { setSoundStatus('blocked'); }
  };
  const react = () => {
    stop(); clearTimeout(reactionTimer.current); clearTimeout(bubbleTimer.current);
    const next = nextPunchReaction(reactionBag.current, lastReaction.current);
    lastReaction.current = next; setReaction(next);
    punchSound(); setNodding(false); reacting.current = true; setPose('ouch'); setBubble('Ouch!');
    reactionTimer.current = setTimeout(() => { reacting.current = false; setPose('front'); }, 1100);
    bubbleTimer.current = setTimeout(() => setBubble(''), 2200);
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
  return <div ref={pet} className={`sallu-pet ${walking ? 'is-walking' : ''} ${pose === 'ouch' ? 'is-ouch' : ''} ${nodding ? 'is-nodding' : ''} ${dragging ? 'is-dragging' : ''}`}
    hidden={open} data-pose={pose} data-direction={direction} data-reaction={pose === 'ouch' ? punchReactions[reaction] : undefined} data-sound={muted ? 'muted' : soundStatus}
    style={{ '--pet-size': `${size}px`, left: position.x, bottom: position.y }}
    onPointerEnter={event => { hoverStoppedWalk.current = walkingRef.current; if (event.target.closest('.sallu-pet__settings, .sallu-pet__menu')) return; stop(); if (!reacting.current) setPose('front'); }}
    onPointerLeave={() => { if (!menu) hoverStoppedWalk.current = false; }}
    >
    <div className="sallu-pet__bubble" role="status" aria-live="polite">{bubble}</div>
    <div key={pose === 'ouch' ? `reaction-${reaction}` : 'idle'} className={`sallu-pet__sprite sallu-pet__sprite--${pose} ${pose.startsWith('gaze-') ? 'sallu-pet__sprite--gaze' : ''}`} aria-hidden="true">
      {(pose === 'ouch' || pose.startsWith('gaze-')) && <span style={spriteFrameStyle(pose === 'ouch' ? 'reactions' : 'gaze', pose === 'ouch' ? reaction : Number(pose.slice(5)), size)} />}
    </div>
    <div className="sallu-pet__nod-head sallu-pet__sprite" aria-hidden="true" />
    <button type="button" className="sallu-pet__hit sallu-pet__face" {...dragEvents} onClick={event => clickPet(event, chat)} aria-label="Chat with Sallu" title="Click to chat; drag to move" />
    <button type="button" className="sallu-pet__hit sallu-pet__body" {...dragEvents} onClick={event => clickPet(event, react)} aria-label="Poke Sallu" title="Click to poke; drag to move" />
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
