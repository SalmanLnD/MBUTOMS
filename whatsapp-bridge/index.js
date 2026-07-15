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
  CATCHUP_MESSAGE_LIMIT = '400',
  CATCHUP_LOOKBACK_HOURS = '36',
  PUNCH_POLL_MS = '45000',
  SYNC_FAIL_RECONNECT_AFTER = '3',
  HISTORY_LOAD_ROUNDS = '12',
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
const catchupMessageLimit = Number(CATCHUP_MESSAGE_LIMIT) || 400;
const catchupLookbackMs = (Number(CATCHUP_LOOKBACK_HOURS) || 36) * 60 * 60 * 1000;
const punchPollMs = Number(PUNCH_POLL_MS) || 45000;
const syncFailReconnectAfter = Number(SYNC_FAIL_RECONNECT_AFTER) || 3;
const historyLoadRounds = Number(HISTORY_LOAD_ROUNDS) || 12;
const notReadyGraceMs = Math.max(watchdogIntervalMs, 120000);
const PROCESSED_IDS_PATH = './.processed-message-ids.json';

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

/** Stable id for live wwebjs Message objects and scraped Store rows. */
const resolveStableMessageId = (source) => {
  if (!source) return '';
  if (typeof source === 'string' && source.trim()) return source.trim();

  const id = source.id;
  if (typeof id === 'string' && id.trim()) return id.trim();
  if (id?._serialized && String(id._serialized).trim()) return String(id._serialized).trim();
  if (id?.id) {
    const remote = id.remote || source.from || source.to || source.chatId || 'unknown';
    return `${remote}_${id.fromMe ? 1 : 0}_${id.id}`;
  }

  const timestamp = source.timestamp || source.t || 0;
  const author = source.author || source.from || source.phone || 'unknown';
  if (timestamp) return `fallback-${timestamp}-${author}`;
  return '';
};

let processedIdsPersistTimer = null;
const persistProcessedMessageIds = async () => {
  try {
    const fs = await import('node:fs/promises');
    const payload = {
      savedAt: new Date().toISOString(),
      ids: processedMessageIdOrder.slice(-processedIdsMax),
    };
    await fs.writeFile(PROCESSED_IDS_PATH, `${JSON.stringify(payload)}\n`);
  } catch (error) {
    log(`Failed to persist processed ids: ${error.message}`);
  }
};

const schedulePersistProcessedMessageIds = () => {
  if (processedIdsPersistTimer) return;
  processedIdsPersistTimer = setTimeout(() => {
    processedIdsPersistTimer = null;
    persistProcessedMessageIds().catch(() => {});
  }, 2000);
};

const loadProcessedMessageIds = async () => {
  try {
    const fs = await import('node:fs/promises');
    const raw = await fs.readFile(PROCESSED_IDS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const ids = Array.isArray(parsed?.ids) ? parsed.ids : [];
    for (const id of ids) {
      if (!id || processedMessageIds.has(id)) continue;
      processedMessageIds.add(id);
      processedMessageIdOrder.push(id);
    }
    while (processedMessageIdOrder.length > processedIdsMax) {
      const oldest = processedMessageIdOrder.shift();
      if (oldest) processedMessageIds.delete(oldest);
    }
    log(`Loaded ${processedMessageIds.size} processed message ids from disk`);
  } catch {
    // first run or corrupt file — start empty
  }
};

const rememberProcessedMessageId = (messageId) => {
  if (!messageId || processedMessageIds.has(messageId)) return;
  processedMessageIds.add(messageId);
  processedMessageIdOrder.push(messageId);
  while (processedMessageIdOrder.length > processedIdsMax) {
    const oldest = processedMessageIdOrder.shift();
    if (oldest) processedMessageIds.delete(oldest);
  }
  schedulePersistProcessedMessageIds();
};

const ensureSingleBridgeInstance = async () => {
  const lockPath = './.bridge-instance.lock';
  const fs = await import('node:fs/promises');

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
let punchPollTimer = null;
let readyTimeout = null;
let reconnectAttempt = 0;
let lastTargetGroupActivityAt = null;
let lastSuccessfulSyncAt = 0;
let consecutiveSyncFailures = 0;
let syncInFlight = false;
let lastReadyAt = 0;
let bridgeStartedAt = Date.now();
let shuttingDown = false;

const READY_TIMEOUT_MS = Number(process.env.READY_TIMEOUT_MS) || 180000;

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
      log(`Ready timeout after ${Math.round(READY_TIMEOUT_MS / 1000)}s — checking if Store is usable`);
      forceActivateIfStoreReady('ready-timeout-store-check')
        .then((activated) => {
          if (!activated && !bridgeReady && !shuttingDown && !reconnecting) {
            log('Store not ready either — forcing reconnect');
            scheduleReconnect('ready-timeout');
          }
        })
        .catch((error) => {
          log(`Store check failed: ${error.message}`);
          scheduleReconnect('ready-timeout');
        });
    }
  }, READY_TIMEOUT_MS);
};

let activateBridgeFn = null;
const forceActivateIfStoreReady = async (reason) => {
  if (bridgeReady || shuttingDown || !client?.pupPage || typeof activateBridgeFn !== 'function') {
    return false;
  }
  const probe = await client.pupPage.evaluate(() => {
    try {
      const collections = window.require?.('WAWebCollections');
      const chatCount = collections?.Chat?.getModelsArray?.()?.length || 0;
      return {
        hasRequire: typeof window.require === 'function',
        hasCollections: Boolean(collections),
        chatCount,
        hasWWebJS: Boolean(window.WWebJS),
      };
    } catch (error) {
      return { error: String(error?.message || error) };
    }
  });
  log(`Store probe (${reason}): ${JSON.stringify(probe)}`);
  if (probe?.hasCollections || probe?.hasWWebJS || (probe?.chatCount || 0) > 0) {
    log(`Forcing bridge activation (${reason})`);
    await activateBridgeFn(reason);
    return true;
  }
  return false;
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

    // Prefer sync health over "no new punches". Quiet mornings after the rush
    // used to trigger punch-idle reconnects and drop the live session.
    if (GROUP_ID && isPunchWatchWindow()) {
      const syncStaleMs = Date.now() - (lastSuccessfulSyncAt || lastReadyAt || bridgeStartedAt);
      if (lastSuccessfulSyncAt && syncStaleMs > Math.max(watchdogPunchIdleMs, punchPollMs * 4)) {
        log(`Watchdog: punch sync stale for ${Math.round(syncStaleMs / 60000)} minutes during punch window`);
        await reconnectBridge('watchdog:sync-stale');
        return;
      }
      if (consecutiveSyncFailures >= syncFailReconnectAfter) {
        log(`Watchdog: ${consecutiveSyncFailures} consecutive punch sync failures`);
        await reconnectBridge('watchdog:sync-failures');
        return;
      }
    }

    // Intentionally do not call getChatById here — recent WhatsApp Web builds
    // throw opaque errors from that API even while the live message listener works.
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
  if (punchPollTimer) clearInterval(punchPollTimer);
  if (processedIdsPersistTimer) {
    clearTimeout(processedIdsPersistTimer);
    processedIdsPersistTimer = null;
  }
  clearReadyTimeout();
  await persistProcessedMessageIds();
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
  activeClient.on('loading_screen', (percent, message) => {
    log(`Loading screen ${percent}% ${message || ''}`.trim());
  });
  activeClient.on('change_state', (state) => {
    log(`WhatsApp state changed: ${state}`);
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

  const isTargetGroupMessage = (message) => {
    if (!GROUP_ID && !GROUP_NAME) return false;
    const chatId = message.from?.endsWith?.('@g.us')
      ? message.from
      : message.to?.endsWith?.('@g.us')
        ? message.to
        : '';
    if (GROUP_ID) return chatId === GROUP_ID;
    return false;
  };

  const resolveTargetChatName = async (message) => {
    if (!GROUP_NAME) return false;
    try {
      const chat = await message.getChat();
      return Boolean(chat?.isGroup && chat.name === GROUP_NAME);
    } catch {
      return false;
    }
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
    const messageId = resolveStableMessageId(message);
    if (!messageId) {
      log('Live message missing stable id — leaving for poller/catch-up');
      return;
    }
    if (processedMessageIds.has(messageId) || inFlightMessageIds.has(messageId)) return;

    try {
      let inTargetGroup = isTargetGroupMessage(message);
      if (!inTargetGroup && GROUP_NAME && !GROUP_ID) {
        inTargetGroup = await resolveTargetChatName(message);
      }
      if (!inTargetGroup) return;

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
      const payload = { phone, oifNumber, punchInAt, whatsappMessageId: messageId };
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
      // Permanent client errors will not succeed on retry — avoid infinite loops.
      if (status === 400 || status === 404) {
        rememberProcessedMessageId(messageId);
      }
      // Do not mark processed for 5xx / network — allow later catch-up / retry.
    } finally {
      inFlightMessageIds.delete(messageId);
    }
  };

  const patchWhatsAppStoreApis = async () => {
    if (!activeClient.pupPage) return;
    try {
      const result = await activeClient.pupPage.evaluate(() => {
        const collections = window.require?.('WAWebCollections');
        if (!collections) return 'no-collections';

        const ensureUpdateSafe = (bucketName, altName) => {
          const bucket = collections[bucketName] || collections[altName];
          if (!bucket) {
            collections[bucketName] = { update: async () => null };
            return `${bucketName}:stubbed`;
          }
          if (typeof bucket.update !== 'function') {
            bucket.update = async () => null;
            return `${bucketName}:added-update`;
          }
          const original = bucket.update.bind(bucket);
          bucket.update = async (...args) => {
            try {
              return await original(...args);
            } catch {
              return null;
            }
          };
          return `${bucketName}:wrapped`;
        };

        const parts = [
          ensureUpdateSafe('GroupMetadata', 'WAWebGroupMetadataCollection'),
          ensureUpdateSafe('NewsletterMetadataCollection', 'WAWebNewsletterMetadataCollection'),
        ];

        // Harden library helper if it already injected.
        if (window.WWebJS?.getChatModel) {
          const originalGetChatModel = window.WWebJS.getChatModel.bind(window.WWebJS);
          window.WWebJS.getChatModel = async (chat, opts = {}) => {
            try {
              return await originalGetChatModel(chat, opts);
            } catch (error) {
              if (!chat) return null;
              try {
                const model = chat.serialize();
                model.isGroup = Boolean(chat.groupMetadata);
                model.formattedTitle = chat.formattedTitle;
                model.groupMetadata = chat.groupMetadata?.serialize?.() || null;
                model.lastMessage = null;
                delete model.msgs;
                return model;
              } catch {
                throw error;
              }
            }
          };
          parts.push('getChatModel:wrapped');
        }

        return parts.join(',');
      });
      log(`Store API patch: ${result}`);
    } catch (error) {
      log(`Store API patch failed: ${error?.message || error}`);
    }
  };

  const scrapeGroupMediaMessages = async (cutoffMs) => {
    if (!activeClient.pupPage || !GROUP_ID) {
      return { error: 'no-page-or-group', messages: [] };
    }

    return activeClient.pupPage.evaluate(async (groupId, cutoffSec, limit, historyRounds) => {
      const tryUser = (widLike) => {
        if (!widLike) return '';
        if (typeof widLike === 'object' && widLike.user) return String(widLike.user);
        if (typeof widLike === 'string') return widLike.split('@')[0];
        return '';
      };

      const collections = window.require('WAWebCollections');
      const widFactory = window.require('WAWebWidFactory');
      const toPn = window.require('WAWebLidMigrationUtils')?.toPn;
      const wid = widFactory.createWid(groupId);

      let chat = null;
      try {
        chat = collections.Chat?.get?.(wid) || collections.Chat?.get?.(groupId) || null;
      } catch {
        chat = null;
      }

      if (!chat) {
        const models = collections.Chat?.getModelsArray?.()
          || Object.values(collections.Chat?._models || {})
          || [];
        chat = models.find((item) => item?.id?._serialized === groupId) || null;
      }

      if (!chat) {
        try {
          const findChat = window.require('WAWebFindChatAction')?.findChat;
          if (findChat) chat = await findChat(wid);
        } catch {
          // ignore
        }
      }

      if (!chat) {
        try {
          const query = window.require('WAWebChatGetters');
          // no-op probe; keep for future WA builds
          void query;
        } catch {
          // ignore
        }
      }

      if (!chat) {
        const sampleIds = (collections.Chat?.getModelsArray?.() || [])
          .slice(0, 40)
          .map((item) => item?.id?._serialized)
          .filter(Boolean);
        return {
          error: 'not-found',
          sampleIds,
          chatCount: sampleIds.length,
          messages: [],
        };
      }

      try {
        const Cmd = window.require('WAWebCmd')?.Cmd;
        if (Cmd?.openChatBottom) await Cmd.openChatBottom(chat);
        else if (Cmd?.openChatAt) await Cmd.openChatAt({ chat, msgContext: null });
      } catch {
        // ignore open failures
      }

      try {
        const loader = window.require('WAWebChatLoadMessagesMsgAction')
          || window.require('WAWebChatLoadMessages')
          || window.Store?.ConversationMsgs;
        for (let i = 0; i < historyRounds; i += 1) {
          const current = chat.msgs?.getModelsArray?.() || [];
          const oldest = current.reduce((min, msg) => {
            const t = Number(msg?.t) || 0;
            if (!t) return min;
            return min === 0 ? t : Math.min(min, t);
          }, 0);
          if (oldest && oldest <= cutoffSec) break;

          if (loader?.loadEarlierMsgs) {
            // eslint-disable-next-line no-await-in-loop
            await loader.loadEarlierMsgs(chat);
          } else if (typeof chat.loadEarlierMsgs === 'function') {
            // eslint-disable-next-line no-await-in-loop
            await chat.loadEarlierMsgs();
          } else {
            break;
          }
        }
      } catch {
        // ignore history load failures
      }

      const mediaTypes = new Set(['image', 'video', 'document', 'sticker', 'ptt', 'audio', 'album', 'gif']);
      const msgs = chat.msgs?.getModelsArray?.() || [];
      const ownUser = window.Store?.Conn?.wid?.user
        || window.require?.('WAWebUserPrefsMeUser')?.getMaybeMePnUser?.()?.user
        || '';

      const rows = [];
      for (const msg of msgs) {
        if (!msg?.t || msg.t < cutoffSec) continue;
        const type = msg.type || '';
        const hasMedia = mediaTypes.has(type)
          || Boolean(msg.mediaData)
          || Boolean(msg.deprecatedMms3Url)
          || Boolean(msg.directPath)
          || Boolean(msg.mimetype);
        const body = msg.caption || msg.body || msg.text || msg.captionText || '';
        let author = '';
        if (msg.author) author = msg.author._serialized || String(msg.author);
        else if (msg.id?.fromMe) author = 'fromMe';
        else if (msg.sender) author = msg.sender._serialized || String(msg.sender);

        let phone = '';
        try {
          if (author === 'fromMe') {
            phone = ownUser;
          } else if (author) {
            const authorWid = widFactory.createWid(author);
            const contact = await collections.Contact.find(authorWid);
            phone = tryUser(contact?.phoneNumber)
              || tryUser(contact?.id)
              || tryUser(toPn?.(authorWid));
            if (!phone && contact?.phoneNumber?.user) phone = String(contact.phoneNumber.user);
          }
        } catch {
          // ignore contact resolution failures
        }

        const stableId = (msg.id?._serialized && String(msg.id._serialized).trim())
          || (msg.id?.id
            ? `${msg.id.remote || groupId}_${msg.id.fromMe ? 1 : 0}_${msg.id.id}`
            : '')
          || `fallback-${msg.t}-${author || 'unknown'}`;

        rows.push({
          id: stableId,
          timestamp: msg.t,
          hasMedia,
          body,
          author,
          phone: String(phone || '').replace(/\D/g, ''),
          type,
        });
      }

      rows.sort((a, b) => a.timestamp - b.timestamp);

      // Never drop older in-window media punches when the chat is busy.
      // Keep all media in the lookback window, then fill remaining slots with
      // newest non-media rows only if we still have budget.
      const mediaRows = rows.filter((row) => row.hasMedia
        || ['image', 'video', 'document', 'album', 'gif'].includes(row.type));
      let selected = mediaRows;
      if (selected.length > limit) {
        selected = mediaRows.slice(-limit);
      } else {
        const mediaIds = new Set(mediaRows.map((row) => row.id));
        const extras = rows.filter((row) => !mediaIds.has(row.id)).slice(-(limit - mediaRows.length));
        selected = [...mediaRows, ...extras].sort((a, b) => a.timestamp - b.timestamp);
      }

      return {
        chatId: chat.id?._serialized || groupId,
        msgCount: msgs.length,
        oldestTs: selected[0]?.timestamp || rows[0]?.timestamp || 0,
        newestTs: selected[selected.length - 1]?.timestamp || rows[rows.length - 1]?.timestamp || 0,
        mediaCount: mediaRows.length,
        truncated: mediaRows.length > limit,
        messages: selected,
      };
    }, GROUP_ID, Math.floor(cutoffMs / 1000), catchupMessageLimit, historyLoadRounds);
  };

  const processScrapedPunch = async (raw, { fromCatchUp = false } = {}) => {
    const messageId = resolveStableMessageId(raw);
    if (!messageId) return 'skip-no-id';
    if (processedMessageIds.has(messageId) || inFlightMessageIds.has(messageId)) return 'skip-dup';
    // Prefer media punches; still accept captioned media-like types.
    if (!raw.hasMedia && !['image', 'video', 'document', 'album', 'gif'].includes(raw.type)) {
      return 'skip-non-media';
    }

    inFlightMessageIds.add(messageId);
    try {
      let phone = digitsOnly(raw.phone || '');
      if (!isLikelyPhoneUserId(phone) && raw.author && raw.author !== 'fromMe') {
        phone = await resolvePhoneFromLid(raw.author);
      }
      if (!isLikelyPhoneUserId(phone) && raw.author === 'fromMe') {
        phone = digitsOnly(activeClient.info?.wid?.user || '');
      }
      if (!isLikelyPhoneUserId(phone)) {
        log(`Could not resolve sender phone (author=${raw.author || 'unknown'}), skipping`);
        return 'skip-phone';
      }

      const oifNumber = extractOifFromText(raw.body);
      if (!oifNumber) {
        log(`No OIF found in message from ${phone} type=${raw.type} body="${String(raw.body || '').slice(0, 40)}", skipping`);
        return 'skip-oif';
      }

      const punchInAt = new Date((raw.timestamp || 0) * 1000).toISOString();
      log(`${fromCatchUp ? 'Catch-up forwarding' : 'Poll forwarding'} punch-in from ${phone}, OIF ${oifNumber}`);
      const data = await forwardPunchIn({
        phone,
        oifNumber,
        punchInAt,
        whatsappMessageId: messageId,
      });
      rememberProcessedMessageId(messageId);
      touchTargetGroupActivity();
      log(`Recorded: ${data?.trainer?.name || phone} | OIF ${oifNumber} | ${punchInAt}`);
      return 'recorded';
    } catch (error) {
      const status = error.response?.status;
      const detail = error.response?.data?.message || error.message;
      log(`Failed to forward punch-in (${status || 'no response'}): ${detail}`);
      if (status === 400 || status === 404) {
        rememberProcessedMessageId(messageId);
        return 'skip-client-error';
      }
      return 'error';
    } finally {
      inFlightMessageIds.delete(messageId);
    }
  };

  const syncGroupPunches = async (label = 'Sync') => {
    if (!GROUP_ID || !bridgeReady || !activeClient?.pupPage) return;
    if (syncInFlight) {
      log(`${label}: skipped overlapping sync`);
      return;
    }
    syncInFlight = true;
    const cutoffMs = Date.now() - catchupLookbackMs;
    try {
      const scraped = await scrapeGroupMediaMessages(cutoffMs);
      if (scraped?.error) {
        consecutiveSyncFailures += 1;
        log(`${label}: store scrape error=${scraped.error} chats=${scraped.chatCount || 0} fails=${consecutiveSyncFailures}`);
        if (scraped.sampleIds?.length) {
          log(`${label}: sample chat ids: ${scraped.sampleIds.slice(0, 8).join(', ')}`);
        }
        return;
      }

      const recent = (scraped.messages || []).filter((row) => (row.timestamp || 0) * 1000 >= cutoffMs);
      const oldest = scraped.oldestTs ? new Date(scraped.oldestTs * 1000).toISOString() : '-';
      const newest = scraped.newestTs ? new Date(scraped.newestTs * 1000).toISOString() : '-';
      log(`${label}: scanned ${recent.length}/${scraped.msgCount || 0} msgs media=${scraped.mediaCount || 0} truncated=${Boolean(scraped.truncated)} range=${oldest}..${newest}`);

      const sample = recent.slice(-8).map((row) => ({
        t: new Date((row.timestamp || 0) * 1000).toISOString().slice(11, 19),
        type: row.type,
        media: row.hasMedia,
        phone: row.phone || '-',
        body: String(row.body || '').slice(0, 28),
      }));
      if (sample.length) log(`${label}: sample ${JSON.stringify(sample)}`);

      const counts = {
        recorded: 0,
        'skip-dup': 0,
        'skip-no-id': 0,
        'skip-non-media': 0,
        'skip-phone': 0,
        'skip-oif': 0,
        'skip-client-error': 0,
        error: 0,
      };
      for (const row of recent) {
        // eslint-disable-next-line no-await-in-loop
        const result = await processScrapedPunch(row, { fromCatchUp: true });
        if (counts[result] !== undefined) counts[result] += 1;
      }
      log(`${label}: results ${JSON.stringify(counts)}`);

      lastSuccessfulSyncAt = Date.now();
      consecutiveSyncFailures = 0;
      if (counts['skip-no-id'] > 0) {
        log(`${label}: WARNING ${counts['skip-no-id']} messages still lacked stable ids`);
      }
    } catch (error) {
      consecutiveSyncFailures += 1;
      log(`${label} failed: ${error?.message || error} fails=${consecutiveSyncFailures}`);
    } finally {
      syncInFlight = false;
    }
  };

  let localPunchPollTimer = null;
  const startPunchPoller = () => {
    if (punchPollTimer) clearInterval(punchPollTimer);
    if (localPunchPollTimer) clearInterval(localPunchPollTimer);
    punchPollTimer = setInterval(() => {
      if (!bridgeReady || reconnecting || shuttingDown) return;
      syncGroupPunches('Poll').catch((error) => log('Poll error:', error.message));
    }, punchPollMs);
    localPunchPollTimer = punchPollTimer;
  };

  const catchUpRecentGroupMessages = async () => {
    if (!GROUP_ID) return;
    await sleep(8000);
    try {
      const state = await activeClient.getState();
      log(`Catch-up: WhatsApp state=${state}`);
    } catch (error) {
      log(`Catch-up: getState failed: ${error?.message || error}`);
    }

    if (typeof activeClient.interface?.openChatWindow === 'function') {
      try {
        await activeClient.interface.openChatWindow(GROUP_ID);
        await sleep(4000);
        log('Catch-up: opened punch group chat window');
      } catch (error) {
        log(`Catch-up: openChatWindow failed: ${error?.message || error}`);
      }
    }

    await syncGroupPunches('Catch-up');
  };

  const activateBridge = async (reason = 'ready') => {
    if (ONE_SHOT_MODE) return;
    if (bridgeReady) {
      log(`Bridge already active, skip (${reason})`);
      return;
    }

    clearReadyTimeout();
    log(`Bridge is ready (${reason})`);
    bridgeReady = true;
    reconnectAttempt = 0;
    lastReadyAt = Date.now();
    touchTargetGroupActivity();

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

    await patchWhatsAppStoreApis();
    startPunchPoller();
    await catchUpRecentGroupMessages();
    lastSuccessfulSyncAt = Date.now();
  };
  activateBridgeFn = activateBridge;

  activeClient.on('ready', async () => {
    if (ONE_SHOT_MODE) {
      clearReadyTimeout();
      log('Bridge is ready');
      bridgeReady = true;
      try {
        log('Fetching groups (this can take up to a minute on first connect)...');
        await sleep(8000);
        await patchWhatsAppStoreApis();

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

    await activateBridge('ready-event');
  });

  activeClient.on('message', (message) => {
    if (GROUP_ID && (message.from === GROUP_ID || message.to === GROUP_ID)) {
      log(`Live group event media=${Boolean(message.hasMedia)} from=${message.from} author=${message.author || ''}`);
    }
    handleMessage(message).catch((error) => log('Message handler error:', error.message));
  });
  activeClient.on('message_create', (message) => {
    if (GROUP_ID && (message.from === GROUP_ID || message.to === GROUP_ID)) {
      log(`Live create event media=${Boolean(message.hasMedia)} fromMe=${Boolean(message.fromMe)} author=${message.author || ''}`);
    }
    handleMessage(message).catch((error) => log('Message handler error:', error.message));
  });
};

const startBridge = async () => {
  if (!ONE_SHOT_MODE) {
    await loadProcessedMessageIds();
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
