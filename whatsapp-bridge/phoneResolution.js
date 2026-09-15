// Self-contained because Puppeteer serializes this function into WhatsApp Web.
export const resolvePhoneInPage = async (senderId) => {
  const asPhone = (value) => {
    if (!value) return '';
    const serialized = typeof value === 'string' ? value : value._serialized;
    const server = value.server || serialized?.split('@')[1];
    if (server && !['c.us', 's.whatsapp.net'].includes(server)) return '';
    const digits = String(value.user || serialized?.split('@')[0] || '').replace(/\D/g, '');
    return digits.length === 10 || (digits.length === 12 && digits.startsWith('91')) ? digits : '';
  };
  const direct = asPhone(senderId);
  if (direct && senderId.includes('@')) return { phone: direct, source: 'sender' };
  const uid = senderId.includes('@') ? senderId : `${senderId}@lid`;
  const wid = window.require('WAWebWidFactory').createWid(uid);
  const lookups = [
    ['contact.phoneNumber', async () => (await window.require('WAWebCollections').Contact.find(wid))?.phoneNumber],
    ['WWebJS.getContact', async () => {
      const contact = await window.WWebJS?.getContact?.(uid);
      // getContact can return the LID itself; preserve its server when validating.
      return contact?.phoneNumber || contact?.id;
    }],
    ['enforceLidAndPnRetrieval', async () => (await window.WWebJS?.enforceLidAndPnRetrieval?.(uid))?.phone],
    ['toPn', async () => window.require('WAWebLidMigrationUtils')?.toPn?.(wid)],
  ];
  for (const [source, lookup] of lookups) {
    try {
      const phone = asPhone(await lookup());
      if (phone) return { phone, source };
    } catch {
      // A missing contact/module must not prevent the remaining resolution paths.
    }
  }
  return null;
};
