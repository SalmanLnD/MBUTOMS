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
} = process.env;

const LIST_GROUPS = process.argv.includes('--list-groups');
const verifyGroupArg = process.argv.find((arg) => arg.startsWith('--verify-group='));
const VERIFY_GROUP_ID = verifyGroupArg?.split('=').slice(1).join('=') || process.env.VERIFY_GROUP_ID || '';

if (!LIST_GROUPS && (!WEBHOOK_URL || !WEBHOOK_SECRET)) {
  console.error('Missing WEBHOOK_URL or WEBHOOK_SECRET in .env');
  process.exit(1);
}

const oifPattern = new RegExp(OIF_REGEX, 'i');
const processedMessageIds = new Set();

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

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    ...(CHROME_BIN ? { executablePath: CHROME_BIN } : {}),
    protocolTimeout: 300000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  },
});

client.on('qr', (qr) => {
  console.log('\nScan this QR code with the WhatsApp account that is in the group:\n');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => log('WhatsApp authenticated'));
client.on('auth_failure', (msg) => log('Auth failure:', msg));
client.on('disconnected', (reason) => log('Disconnected:', reason));

client.on('ready', async () => {
  log('Bridge is ready');

  if (LIST_GROUPS || VERIFY_GROUP_ID) {
    try {
      // WhatsApp Web may still be loading chat metadata when "ready" fires.
      log('Fetching groups (this can take up to a minute on first connect)...');
      await sleep(8000);

      if (VERIFY_GROUP_ID) {
        const chat = await withRetries('getChatById', () => client.getChatById(VERIFY_GROUP_ID), {
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
        const chats = await withRetries('getChats', () => client.getChats(), {
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
        await client.destroy();
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

  const linkedPhone = client.info?.wid?.user;
  if (linkedPhone) {
    log(`Linked WhatsApp number: ${linkedPhone}`);
  }
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

/** Indian mobile: 10 digits, or 12 with leading 91. Rejects WhatsApp @lid ids (15 digits). */
const isLikelyPhoneUserId = (value) => {
  const digits = digitsOnly(value);
  if (digits.length === 10) return true;
  if (digits.length === 12 && digits.startsWith('91')) return true;
  return false;
};

const resolvePhoneFromLid = async (senderId) => {
  if (!client.pupPage || !senderId) return '';

  const contactId = senderId.includes('@') ? senderId : `${senderId}@lid`;

  try {
    const resolved = await client.pupPage.evaluate(async (uid) => {
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

/**
 * In groups, message.from is the group id (@g.us), not the sender.
 * For your own messages (fromMe), message.author is often empty — use the
 * linked WhatsApp account number instead.
 * Other members may appear as @lid privacy ids; resolve via WhatsApp Web API.
 */
const resolveSenderPhone = async (message) => {
  if (message.fromMe) {
    const ownNumber = client.info?.wid?.user || client.info?.me?.user;
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

const handleMessage = async (message) => {
  try {
    if (processedMessageIds.has(message.id._serialized)) return;

    const chat = await message.getChat();
    if (!isTargetGroup(chat)) return;

    const phonePreview = message.author || message.from || 'unknown';
    if (!message.hasMedia) {
      log(`Ignored non-media message in punch group from ${phonePreview}`);
      return;
    }

    processedMessageIds.add(message.id._serialized);

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
    log(`Forwarding punch-in from ${phone}, OIF ${oifNumber}`);

    const { data } = await axios.post(WEBHOOK_URL, payload, {
      headers: { 'x-webhook-secret': WEBHOOK_SECRET },
      timeout: 15000,
    });

    log(`Recorded: ${data?.trainer?.name || phone} | OIF ${oifNumber} | ${punchInAt}`);
  } catch (error) {
    const status = error.response?.status;
    const detail = error.response?.data?.message || error.message;
    const phoneHint = error.response?.data?.phone ? ` (normalized phone: ${error.response.data.phone})` : '';
    log(`Failed to forward punch-in (${status || 'no response'}): ${detail}${phoneHint}`);
  }
};

client.on('message', handleMessage);
client.on('message_create', (message) => {
  // Also catch messages sent from the bridge account itself.
  if (message.fromMe) handleMessage(message);
});

client.initialize();
