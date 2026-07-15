import 'dotenv/config';
import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import axios from 'axios';

const { Client, LocalAuth } = pkg;

const {
  WEBHOOK_URL,
  WEBHOOK_SECRET,
  GROUP_ID = '',
  GROUP_NAME = '',
  OIF_REGEX = '\\bOIF[\\s:_-]*([A-Za-z0-9/-]+)\\b',
  ENABLE_OCR = 'false',
  CHROME_BIN = '',
  RECONNECT_MIN_MS = '15000',
  RECONNECT_MAX_MS = '300000',
  WATCHDOG_INTERVAL_MS = '300000',
  WATCHDOG_PUNCH_IDLE_MS = '1800000',
  PUNCH_WATCH_TZ = 'Asia/Kolkata',
  PUNCH_WATCH_START = '06:30',
  PUNCH_WATCH_END = '11:00',
  PROCESSED_IDS_MAX = '5000',
  CATCHUP_MESSAGE_LIMIT = '150',
  CATCHUP_LOOKBACK_HOURS = '36',
} = process.env;

const LIST_GROUPS = process.argv.includes('--list-groups');
const verifyGroupArg = process.argv.find((arg) => arg.startsWith('--verify-group='));
const VERIFY_GROUP_ID = verifyGroupArg?.split('=').slice(1).join('=') || process.env.VERIFY_GROUP_ID || '';
const ONE_SHOT_MODE = LIST_GROUPS || Boolean(VERIFY_GROUP_ID);

if (!ONE_SHOT_MODE && (!WEBHOOK_URL || !WEBHOOK_SECRET)) {
  console.error('Missing WEBHOOK_URL or WEBHOOK_SECRET in .env');
  process.exit(1);
}

const reconnectMinMs = Number(RECONNECT_MIN_MS) || 15000;
const reconnectMaxMs = Number(RECONNECT_MAX_MS) || 300000;
const watchdogIntervalMs = Number(WATCHDOG_INTERVAL_MS) || 300000;
const watchdogPunchIdleMs = Number(WATCHDOG_PUNCH_IDLE_MS) || 1800000;
const processedIdsMax = Number(PROCESSED_IDS_MAX) || 5000;
const catchupMessageLimit = Number(CATCHUP_MESSAGE_LIMIT) || 150;
const catchupLookbackMs = (Number(CATCHUP_LOOKBACK_HOURS) || 36) * 60 * 60 * 1000;
const notReadyGraceMs = Math.max(watchdogIntervalMs, 120000);

const oifPattern = new RegExp(OIF_REGEX, 'i');
const processedMessageIds = new Set();
const processedMessageIdOrder = [];
const inFlightMessageIds = new Set();

const log = (...args) => console.log(new Date().toISOString(), ...args);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetries = async (label, fn, { attempts = 3, delayMs = 5000 } = {}) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        log(`${label} failed (attempt ${attempt}/${attempts}): ${error.message}. Retrying in ${delayMs / 1000}s...`);
        await sleep(delayMs);
      }
    }
  }
  throw lastError;
};

const rememberProcessedMessageId = (messageId) => {
  if (!messageId || processedMessageIds.has(messageId)) return;
  processedMessageIds.add(messageId);
  processedMessageIdOrder.push(messageId);
  while (processedMessageIdOrder.length > processedIdsMax) {
    const oldest = processedMessageIdOrder.shift();
    if (oldest) processedMessageIds.delete(oldest);
  }
};

const ensureSingleBridgeInstance = async () => {
  const lockPath = './.bridge-instance.lock';
  const fs = await import('node:fs/promises');
  const { execSync } = await import('node:child_process');

  // Hard-stop any other bridge node processes left behind by crashed PM2 restarts.
  try {
    const raw = execSync("pgrep -af 'node .*whatsapp-bridge/index.js' || true", {
      encoding: 'utf8',
    });
    for (const line of raw.split('\n')) {
      const match = line.trim().match(/^(\d+)\s/);
      if (!match) continue;
      const pid = Number(match[1]);
      if (!pid || pid === process.pid) continue;
      try {
        process.kill(pid, 'SIGKILL');
        log(`Killed stale bridge process pid ${pid}`);
      } catch {
        // already gone
      }
    }
  } catch {
    // pgrep unavailable
  }

  try {
    const existing = await fs.readFile(lockPath, 'utf8');
    const [pid, startedAt] = existing.trim().split('|');
    if (pid && pid !== String(process.pid)) {
      try {
        process.kill(Number(pid), 0);
        log(`Another bridge instance is already running (pid ${pid}, started ${startedAt}). Exiting.`);
        process.exit(0);
      } catch {
        // stale lock
      }
    }
  } catch {
    // no lock yet
  }
  await fs.writeFile(lockPath, `${process.pid}|${new Date().toISOString()}\n`);
  const cleanup = async () => {
    try {
      const current = await fs.readFile(lockPath, 'utf8');
      if (current.startsWith(`${process.pid}|`)) {
        await fs.unlink(lockPath);
      }
    } catch {
      // ignore
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', async () => {
    await cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await cleanup();
    process.exit(0);
  });
};

const createClient = () =>
  new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      ...(CHROME_BIN ? { executablePath: CHROME_BIN } : {}),
      protocolTimeout: 300000,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
  });

let client = null;
let bridgeReady = false;
let reconnecting = false;
let reconnectTimer = null;
let watchdogTimer = null;
let readyTimeout = null;
let reconnectAttempt = 0;
let lastTargetGroupActivityAt = null;
let lastReadyAt = 0;
let bridgeStartedAt = Date.now();
let shuttingDown = false;

const READY_TIMEOUT_MS = Number(process.env.READY_TIMEOUT_MS) || 120000;

const clearReadyTimeout = () => {
  if (readyTimeout) {
    clearTimeout(readyTimeout);
    readyTimeout = null;
  }
};

const armReadyTimeout = () => {
  clearReadyTimeout();
  readyTimeout = setTimeout(() => {
    readyTimeout = null;
    if (!bridgeReady && !shuttingDown && !reconnecting) {
      log(`Ready timeout after ${Math.round(READY_TIMEOUT_MS / 1000)}s — forcing reconnect`);
      scheduleReconnect('ready-timeout');
    }
  }, READY_TIMEOUT_MS);
};

const touchTargetGroupActivity = () => {
  lastTargetGroupActivityAt = Date.now();
};

const parseClockToMinutes = (value) => {
  const [hours = '0', minutes = '0'] = String(value).split(':');
  return Number(hours) * 60 + Number(minutes);
};

const punchWatchStartMinutes = parseClockToMinutes(PUNCH_WATCH_START);
const punchWatchEndMinutes = parseClockToMinutes(PUNCH_WATCH_END);

const isPunchWatchWindow = () => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: PUNCH_WATCH_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  const nowMinutes = hour * 60 + minute;
  return nowMinutes >= punchWatchStartMinutes && nowMinutes <= punchWatchEndMinutes;
};

const scheduleReconnect = (reason) => {
  if (ONE_SHOT_MODE || shuttingDown) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const delay = Math.min(reconnectMinMs * 2 ** reconnectAttempt, reconnectMaxMs);
  reconnectAttempt += 1;
  log(`Scheduling reconnect in ${Math.round(delay / 1000)}s (reason: ${reason}, attempt ${reconnectAttempt})`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (shuttingDown) return;
    if (reconnecting) {
      scheduleReconnect(`wait-lock:${reason}`);
      return;
    }
    reconnectBridge(reason).catch((error) => {
      log('Reconnect task failed:', error.message);
      scheduleReconnect(`reconnect-task:${error.message}`);
    });
  }, delay);
};

const reconnectBridge = async (reason) => {
  if (ONE_SHOT_MODE || shuttingDown || reconnecting) return;
  reconnecting = true;
  bridgeReady = false;
  bridgeStartedAt = Date.now();
  log(`Reconnecting bridge (${reason})...`);
  let failedReason = null;
  try {
    if (client) {
      try {
        await client.destroy();
      } catch (error) {
        log('Client destroy failed:', error.message);
      }
      client.removeAllListeners();
      client = null;
    }
    await sleep(3000);
    client = createClient();
    wireClient(client);
    await client.initialize();
  } catch (error) {
    log('Reconnect initialize failed:', error.message);
    failedReason = `init-failed:${error.message}`;
  } finally {
    reconnecting = false;
  }

  // Schedule only after clearing the reconnecting lock (previous bug dropped retries).
  if (failedReason && !shuttingDown && !bridgeReady) {
    scheduleReconnect(failedReason);
  }
};

const runWatchdog = async () => {
  if (ONE_SHOT_MODE || shuttingDown || reconnecting) return;

  if (!client || !bridgeReady) {
    const baseline = lastReadyAt || bridgeStartedAt;
    if (Date.now() - baseline > notReadyGraceMs) {
      log('Watchdog: bridge not ready — scheduling reconnect');
      scheduleReconnect('watchdog:not-ready');
    }
    return;
  }

  try {
    const state = await client.getState();
    if (state !== 'CONNECTED') {
      log(`Watchdog: WhatsApp state is ${state}`);
      await reconnectBridge(`watchdog:state-${state}`);
      return;
    }

    if (GROUP_ID && isPunchWatchWindow() && lastTargetGroupActivityAt) {
      const idleMs = Date.now() - lastTargetGroupActivityAt;
      if (idleMs > watchdogPunchIdleMs) {
        log(`Watchdog: no punch-group activity for ${Math.round(idleMs / 60000)} minutes during punch window`);
        await reconnectBridge('watchdog:punch-idle');
        return;
      }
    }

    if (GROUP_ID) {
      await withRetries('watchdog-getChatById', () => client.getChatById(GROUP_ID), {
        attempts: 2,
        delayMs: 5000,
      });
    }
  } catch (error) {
    log('Watchdog health check failed:', error.message);
    await reconnectBridge(`watchdog:${error.message}`);
  }
};

const startWatchdog = () => {
  if (watchdogTimer) clearInterval(watchdogTimer);
  watchdogTimer = setInterval(() => {
    runWatchdog().catch((error) => log('Watchdog error:', error.message));
  }, watchdogIntervalMs);
};

const shutdownBridge = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (watchdogTimer) clearInterval(watchdogTimer);
  if (client) {
    try {
      await client.destroy();
    } catch {
      // ignore
    }
  }
};

const wireClient = (activeClient) => {
  activeClient.on('qr', (qr) => {
    console.log('\nScan this QR code with the WhatsApp account that is in the group:\n');
    qrcode.generate(qr, { small: true });
  });

  activeClient.on('authenticated', () => {
    log('WhatsApp authenticated');
    armReadyTimeout();
  });
  activeClient.on('auth_failure', (msg) => {
    log('Auth failure:', msg);
    clearReadyTimeout();
    scheduleReconnect(`auth_failure:${msg}`);
  });

  activeClient.on('disconnected', (reason) => {
    log('Disconnected:', reason);
    bridgeReady = false;
    clearReadyTimeout();
    scheduleReconnect(`disconnected:${reason}`);
  });

  const isTargetGroup = (chat) => {
    if (!chat?.isGroup) return false;
    if (GROUP_ID) return chat.id._serialized === GROUP_ID;
    if (GROUP_NAME) return chat.name === GROUP_NAME;
    return false;
  };

  const extractOifFromText = (text) => {
    if (!text) return '';
    const match = text.match(oifPattern);
    return match ? (match[1] || match[0]).trim() : '';
  };

  const digitsOnly = (value) => {
    if (!value) return '';
    return String(value).replace(/\D/g, '');
  };

  const isLikelyPhoneUserId = (value) => {
    const digits = digitsOnly(value);
    if (digits.length === 10) return true;
    if (digits.length === 12 && digits.startsWith('91')) return true;
    return false;
  };

  const resolvePhoneFromLid = async (senderId) => {
    if (!activeClient.pupPage || !senderId) return '';

    const contactId = senderId.includes('@') ? senderId : `${senderId}@lid`;

    try {
      const resolved = await activeClient.pupPage.evaluate(async (uid) => {
        const tryUser = (widLike) => {
          if (!widLike) return null;
          if (typeof widLike === 'object' && widLike.user) return widLike.user;
          if (typeof widLike === 'string') return widLike.split('@')[0];
          return null;
        };

        const widFactory = window.require('WAWebWidFactory');
        const contactStore = window.require('WAWebCollections').Contact;
        const wid = widFactory.createWid(uid);

        const contact = await contactStore.find(wid);
        if (contact?.phoneNumber) {
          const phone = tryUser(contact.phoneNumber);
          if (phone) return { phone, source: 'contact.phoneNumber' };
        }

        if (window.WWebJS?.getContact) {
          const model = await window.WWebJS.getContact(wid._serialized || uid);
          const phone = model?.userid || tryUser(model?.id);
          if (phone) return { phone, source: 'WWebJS.getContact' };
        }

        if (window.WWebJS?.enforceLidAndPnRetrieval) {
          const { phone } = await window.WWebJS.enforceLidAndPnRetrieval(wid._serialized || uid);
          const phoneUser = tryUser(phone);
          if (phoneUser) return { phone: phoneUser, source: 'enforceLidAndPnRetrieval' };
        }

        const toPn = window.require('WAWebLidMigrationUtils')?.toPn;
        if (toPn) {
          const phoneWid = toPn(wid);
          const phone = tryUser(phoneWid);
          if (phone) return { phone, source: 'toPn' };
        }

        return null;
      }, contactId);

      if (resolved?.phone) {
        log(`Resolved ${senderId} via ${resolved.source}: ${resolved.phone}`);
        if (isLikelyPhoneUserId(resolved.phone)) {
          return digitsOnly(resolved.phone);
        }
      }
    } catch (error) {
      log('LID resolution failed:', error.message);
    }

    return '';
  };

  const resolveSenderPhone = async (message) => {
    if (message.fromMe) {
      const ownNumber = activeClient.info?.wid?.user || activeClient.info?.me?.user;
      if (ownNumber) return digitsOnly(ownNumber);
    }

    const senderId = message.author || message.from || '';
    if (!senderId || senderId.endsWith('@g.us')) return '';

    try {
      const contact = await message.getContact();
      const fromContact = digitsOnly(contact?.number) || digitsOnly(contact?.id?.user);
      if (isLikelyPhoneUserId(fromContact)) {
        return fromContact;
      }
    } catch (error) {
      log('Contact lookup failed:', error.message);
    }

    const fromLid = await resolvePhoneFromLid(senderId);
    if (fromLid) return fromLid;

    const [userPart, server = ''] = senderId.split('@');
    if (server === 'lid' || !isLikelyPhoneUserId(userPart)) {
      return '';
    }

    return digitsOnly(userPart);
  };

  const extractOifWithOcr = async (message) => {
    if (String(ENABLE_OCR).toLowerCase() !== 'true') return '';
    try {
      const { createWorker } = await import('tesseract.js');
      const media = await message.downloadMedia();
      if (!media?.data) return '';

      const worker = await createWorker('eng');
      const {
        data: { text },
      } = await worker.recognize(Buffer.from(media.data, 'base64'));
      await worker.terminate();
      return extractOifFromText(text);
    } catch (error) {
      log('OCR failed:', error.message);
      return '';
    }
  };

  const forwardPunchIn = async (payload) => {
    const { data } = await withRetries(
      'webhook',
      () =>
        axios.post(WEBHOOK_URL, payload, {
          headers: { 'x-webhook-secret': WEBHOOK_SECRET },
          timeout: 15000,
        }),
      { attempts: 3, delayMs: 5000 }
    );
    return data;
  };

  const handleMessage = async (message, { fromCatchUp = false } = {}) => {
    const messageId = message.id?._serialized;
    if (!messageId) return;
    if (processedMessageIds.has(messageId) || inFlightMessageIds.has(messageId)) return;

    try {
      const chat = await message.getChat();
      if (!isTargetGroup(chat)) return;

      touchTargetGroupActivity();

      const phonePreview = message.author || message.from || 'unknown';
      if (!message.hasMedia) {
        if (!fromCatchUp) {
          log(`Ignored non-media message in punch group from ${phonePreview}`);
        }
        return;
      }

      inFlightMessageIds.add(messageId);

      const phone = await resolveSenderPhone(message);
      if (!phone) {
        log(`Could not resolve sender phone (author=${message.author || message.from || 'unknown'}), skipping`);
        return;
      }

      let oifNumber = extractOifFromText(message.body);
      if (!oifNumber) {
        oifNumber = await extractOifWithOcr(message);
      }

      if (!oifNumber) {
        log(`No OIF found in message from ${phone}, skipping`);
        return;
      }

      const punchInAt = new Date(message.timestamp * 1000).toISOString();
      const payload = { phone, oifNumber, punchInAt };
      log(`${fromCatchUp ? 'Catch-up forwarding' : 'Forwarding'} punch-in from ${phone}, OIF ${oifNumber}`);

      const data = await forwardPunchIn(payload);
      rememberProcessedMessageId(messageId);
      touchTargetGroupActivity();
      log(`Recorded: ${data?.trainer?.name || phone} | OIF ${oifNumber} | ${punchInAt}`);
    } catch (error) {
      const status = error.response?.status;
      const detail = error.response?.data?.message || error.message;
      const phoneHint = error.response?.data?.phone ? ` (normalized phone: ${error.response.data.phone})` : '';
      log(`Failed to forward punch-in (${status || 'no response'}): ${detail}${phoneHint}`);
      // Do not mark processed — allow later catch-up / retry of the same message id.
    } finally {
      inFlightMessageIds.delete(messageId);
    }
  };

  const catchUpRecentGroupMessages = async () => {
    if (!GROUP_ID) return;
    try {
      const chat = await withRetries('catchup-getChatById', () => activeClient.getChatById(GROUP_ID), {
        attempts: 3,
        delayMs: 5000,
      });
      const messages = await chat.fetchMessages({ limit: catchupMessageLimit });
      const cutoffMs = Date.now() - catchupLookbackMs;
      const recent = messages.filter((message) => (message.timestamp || 0) * 1000 >= cutoffMs);
      log(`Catch-up: scanning ${recent.length}/${messages.length} recent group messages (last ${CATCHUP_LOOKBACK_HOURS}h)`);
      for (const message of recent) {
        await handleMessage(message, { fromCatchUp: true });
      }
      log('Catch-up complete');
    } catch (error) {
      log('Catch-up failed:', error.message);
    }
  };

  activeClient.on('ready', async () => {
    clearReadyTimeout();
    log('Bridge is ready');
    bridgeReady = true;
    reconnectAttempt = 0;
    lastReadyAt = Date.now();
    touchTargetGroupActivity();

    if (ONE_SHOT_MODE) {
      try {
        log('Fetching groups (this can take up to a minute on first connect)...');
        await sleep(8000);

        if (VERIFY_GROUP_ID) {
          const chat = await withRetries('getChatById', () => activeClient.getChatById(VERIFY_GROUP_ID), {
            attempts: 3,
            delayMs: 10000,
          });
          console.log('\nGroup lookup:\n');
          if (!chat?.isGroup) {
            console.log(`  ${VERIFY_GROUP_ID} is not a group this account can access.`);
          } else {
            console.log(`  ${chat.name}  ->  ${chat.id._serialized}`);
          }
          console.log('');
        } else {
          const chats = await withRetries('getChats', () => activeClient.getChats(), {
            attempts: 3,
            delayMs: 10000,
          });
          const groups = chats.filter((chat) => chat.isGroup);
          console.log('\nGroups this account can see:\n');
          if (!groups.length) {
            console.log('  (no groups found — make sure this WhatsApp account is in the punch-in group)');
          } else {
            groups.forEach((group) => {
              console.log(`  ${group.name}  ->  ${group.id._serialized}`);
            });
          }
          console.log('\nCopy the id of your punch-in group into GROUP_ID in .env, then restart.\n');
        }
      } catch (error) {
        console.error(`\nFailed to ${VERIFY_GROUP_ID ? 'verify group' : 'list groups'}:`, error.message);
        console.error('Try running "npm run list-groups" again after WhatsApp Web finishes loading.');
        process.exitCode = 1;
      } finally {
        try {
          await activeClient.destroy();
        } catch {
          // ignore shutdown errors
        }
        process.exit(process.exitCode || 0);
      }
      return;
    }

    if (GROUP_ID) {
      log(`Listening to group id: ${GROUP_ID}`);
    } else if (GROUP_NAME) {
      log(`Listening to group name: ${GROUP_NAME}`);
    } else {
      log('WARNING: No GROUP_ID or GROUP_NAME set. Run "npm run list-groups" to find it. Ignoring all messages until set.');
    }

    const linkedPhone = activeClient.info?.wid?.user;
    if (linkedPhone) {
      log(`Linked WhatsApp number: ${linkedPhone}`);
    }

    await catchUpRecentGroupMessages();
  });

  activeClient.on('message', (message) => {
    handleMessage(message).catch((error) => log('Message handler error:', error.message));
  });
  activeClient.on('message_create', (message) => {
    if (message.fromMe) {
      handleMessage(message).catch((error) => log('Message handler error:', error.message));
    }
  });
};

const startBridge = async () => {
  if (!ONE_SHOT_MODE) {
    await ensureSingleBridgeInstance();
    startWatchdog();
    process.once('SIGINT', () => {
      shutdownBridge().finally(() => process.exit(0));
    });
    process.once('SIGTERM', () => {
      shutdownBridge().finally(() => process.exit(0));
    });
  }

  client = createClient();
  wireClient(client);
  await client.initialize();
};

startBridge().catch((error) => {
  log('Bridge startup failed:', error.message);
  if (!ONE_SHOT_MODE) {
    scheduleReconnect(`startup:${error.message}`);
    return;
  }
  process.exit(1);
});
