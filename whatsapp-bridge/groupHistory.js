// Self-contained for execution inside WhatsApp Web through Puppeteer.
export const scrapeGroupMessagesInPage = async (groupId, cutoffSec, limit, historyRounds) => {
  const tryUser = (widLike) => {
    if (!widLike) return '';
    const server = widLike.server || (typeof widLike === 'string' ? widLike : widLike._serialized)?.split('@')[1];
    if (server && !['c.us', 's.whatsapp.net'].includes(server)) return '';
    if (typeof widLike === 'object' && widLike.user) return String(widLike.user);
    if (typeof widLike === 'string') return widLike.split('@')[0];
    return '';
  };

  const collections = window.require('WAWebCollections');
  const widFactory = window.require('WAWebWidFactory');
  const optionalModule = (name) => { try { return window.require(name); } catch { return null; } };
  const toPn = optionalModule('WAWebLidMigrationUtils')?.toPn;
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

  const historyMessages = new Map();
  const collect = (messages) => {
    for (const msg of messages || []) {
      const key = msg.id?._serialized || msg.id?.id || `${msg.t}-${msg.author}`;
      historyMessages.set(key, msg);
    }
  };
  collect(chat.msgs?.getModelsArray?.());
  let historyError = null;
  let historyComplete = false;
  try {
    const loader = optionalModule('WAWebChatLoadMessages');
    for (let i = 0; i < historyRounds; i += 1) {
      collect(chat.msgs?.getModelsArray?.());
      const current = [...historyMessages.values()];
      const oldest = current.reduce((min, msg) => {
        const t = Number(msg?.t) || 0;
        if (!t) return min;
        return min === 0 ? t : Math.min(min, t);
      }, 0);
      if (oldest && oldest <= cutoffSec) { historyComplete = true; break; }
      let loaded;
      if (loader?.loadEarlierMsgs) {
        // eslint-disable-next-line no-await-in-loop
        loaded = await loader.loadEarlierMsgs({ chat });
      } else if (typeof chat.loadEarlierMsgs === 'function') {
        // eslint-disable-next-line no-await-in-loop
        loaded = await chat.loadEarlierMsgs();
      } else {
        historyError = 'history-loader-unavailable';
        break;
      }
      collect(loaded);
      collect(chat.msgs?.getModelsArray?.());
      if (Array.isArray(loaded) && loaded.length === 0) { historyComplete = true; break; }
      if (historyMessages.size === current.length) { historyError = 'history-load-no-progress'; break; }
    }
    if (!historyComplete && !historyError) {
      historyComplete = [...historyMessages.values()].some((msg) => msg.t > 0 && msg.t <= cutoffSec);
      if (!historyComplete) historyError = 'history-round-limit';
    }
  } catch (error) {
    historyError = `history-load-failed: ${error?.message || String(error)}`;
  }

  const mediaTypes = new Set(['image', 'video', 'document', 'sticker', 'ptt', 'audio', 'album', 'gif']);
  const msgs = [...historyMessages.values()];
  const ownUser = window.Store?.Conn?.wid?.user
    || optionalModule('WAWebUserPrefsMeUser')?.getMaybeMePnUser?.()?.user
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
          || (author.endsWith('@c.us') || author.endsWith('@s.whatsapp.net') ? tryUser(author) : '')
          || tryUser(toPn?.(authorWid));
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

  // Prefer punches that include media OR an OIF caption/body so text-only
  // punches are not dropped when the lookback window is busy.
  const oifLike = (body) => /\bOIF[\s:_-]*/i.test(String(body || ''));
  const priorityRows = rows.filter((row) => row.hasMedia
    || ['image', 'video', 'document', 'album', 'gif'].includes(row.type)
    || oifLike(row.body));
  let selected = priorityRows;
  if (selected.length > limit) {
    selected = priorityRows.slice(-limit);
  } else {
    const selectedIds = new Set(priorityRows.map((row) => row.id));
    const extras = rows
      .filter((row) => !selectedIds.has(row.id))
      .slice(-(limit - priorityRows.length));
    selected = [...priorityRows, ...extras].sort((a, b) => a.timestamp - b.timestamp);
  }

  return {
    historyComplete,
    historyError,
    chatId: chat.id?._serialized || groupId,
    msgCount: msgs.length,
    oldestTs: selected[0]?.timestamp || rows[0]?.timestamp || 0,
    newestTs: selected[selected.length - 1]?.timestamp || rows[rows.length - 1]?.timestamp || 0,
    mediaCount: priorityRows.filter((row) => row.hasMedia
      || ['image', 'video', 'document', 'album', 'gif'].includes(row.type)).length,
    oifCount: priorityRows.filter((row) => oifLike(row.body)).length,
    truncated: priorityRows.length > limit,
    messages: selected,
  };
};
