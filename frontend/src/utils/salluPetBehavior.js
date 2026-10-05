export const punchReactions = [
  'ouch', 'surprised', 'offended', 'recoil-left', 'recoil-right',
  'belly-rub', 'dizzy', 'startled', 'duck', 'ticklish',
  'cheeky', 'grumpy', 'pleading', 'gasp', 'boxing',
];

export const reactionDialogues = {
  ouch: ['Ouch! Easy there!', 'Ow! That surprised me!'],
  surprised: ['Whoa! Where did that come from?', 'You caught me off guard!'],
  offended: ['Excuse me, this belly is precious!', 'Hmph! I was being helpful!'],
  'recoil-left': ['Whoa, leaning left!', 'Easy! I nearly lost my balance!'],
  'recoil-right': ['Hey! I am wobbling over here!', 'A little gentler, please!'],
  'belly-rub': ['My tummy needs a break!', 'Careful with the belly!'],
  dizzy: ['Is the room spinning?', 'Give me a second... whoa!'],
  startled: ['Eek! You startled me!', 'My tiny feet almost jumped!'],
  duck: ['Duck and cover!', 'Missed me... almost!'],
  ticklish: ['Heehee! That tickles!', 'Haha! You found my ticklish spot!'],
  cheeky: ['You cannot catch this smile!', 'Hehe! Nice try!'],
  grumpy: ['Hmph! Behave yourself!', 'I am giving you my grumpy face!'],
  pleading: ['Please be gentle with me!', 'A little kindness for Sallu?'],
  gasp: ['Gasp! My goodness!', 'Well, that was dramatic!'],
  boxing: ['Tiny fists, big courage!', 'Playful sparring only!'],
  laughing: ['Hahaha! That tickles!', 'Heehee! My belly is ticklish!', 'Stop, I cannot stop laughing!'],
  crying: ['Sniff... gentler, please!', 'Too many pokes! I need a break.', 'Aww... a little kindness, please!'],
};

export const reactionDialogue = (expression, previous, random = Math.random) => {
  const options = (reactionDialogues[expression] || reactionDialogues.ouch).filter(line => line !== previous);
  return options[Math.min(options.length - 1, Math.floor(random() * options.length))];
};

export const recentPunches = (history, now) => [...history.filter(time => now - time < 4000), now];

// A short horizontal swipe tickles. Holding or pulling vertically still moves him.
export const isStomachSwipe = (dx, dy, duration, size) =>
  duration <= 260 && Math.abs(dx) >= Math.max(12, size * .12)
  && Math.abs(dx) > Math.abs(dy) * 1.6 && Math.abs(dy) <= size * .18;

// A shuffled bag gives every expression a turn and avoids repeated boundaries.
export const nextPunchReaction = (bag, previous, random = Math.random) => {
  if (!bag.length) {
    bag.push(...punchReactions.map((_, index) => index));
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    if (bag[bag.length - 1] === previous) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
  }
  return bag.pop();
};

export const cursorPose = (dx, dy) => {
  const x = Math.abs(dx), ratio = x / Math.max(1, Math.abs(dy));
  if (x < 55 && Math.abs(dy) < 65) return 'front';
  if (dy < -70) {
    if (x < 55) return 'gaze-2';
    if (x > 650 && ratio > 2.4) return dx < 0 ? 'gaze-14' : 'gaze-15';
    if (dx < 0) return `gaze-${ratio < .65 ? 0 : ratio < 1.4 ? 1 : 5}`;
    return ratio < .65 ? 'gaze-3' : 'gaze-6';
  }
  if (dy > 70) {
    if (x < 55) return 'gaze-10';
    if (dx < 0) return ratio < .65 ? 'gaze-8' : 'gaze-9';
    return 'gaze-11';
  }
  if (x > 480) return dx < 0 ? 'gaze-4' : 'gaze-7';
  return dx < 0 ? 'gaze-12' : 'gaze-13';
};

export const playPunchSound = async ctx => {
  // Resume must finish before scheduling; embedded browsers can suspend audio.
  if (ctx.state !== 'running') await ctx.resume();
  if (ctx.state !== 'running') throw new Error('Audio is paused by the browser');
  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator(), thump = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(230, now);
  oscillator.frequency.exponentialRampToValueAtTime(75, now + .22);
  thump.gain.setValueAtTime(.65, now);
  thump.gain.exponentialRampToValueAtTime(.001, now + .3);
  oscillator.connect(thump); thump.connect(ctx.destination);
  oscillator.start(now); oscillator.stop(now + .32);
  oscillator.onended = () => { oscillator.disconnect(); thump.disconnect(); };

  // Short filtered noise adds an audible impact on small speakers.
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .13), ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  let seed = 5731;
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    samples[i] = (seed / 4294967296 * 2 - 1) * Math.exp(-i / (ctx.sampleRate * .035));
  }
  const noise = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), impact = ctx.createGain();
  noise.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = 1800; impact.gain.value = .55;
  noise.connect(filter); filter.connect(impact); impact.connect(ctx.destination);
  noise.start(now);
  noise.onended = () => { noise.disconnect(); filter.disconnect(); impact.disconnect(); };
};
