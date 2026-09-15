import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePhoneInPage } from '../phoneResolution.js';

const phone = { user: '919876543210', server: 'c.us' };
const lid = { user: '919999999999', server: 'lid', _serialized: '919999999999@lid' };
const setup = (t, { contactFailure = false, retrievalFailure = false } = {}) => {
  const previous = globalThis.window;
  globalThis.window = {
    require(name) {
      if (name === 'WAWebWidFactory') return { createWid: () => lid };
      if (name === 'WAWebCollections') return { Contact: { find: async () => {
        if (contactFailure) throw new Error('Contact unavailable');
        return { id: lid };
      } } };
      if (name === 'WAWebLidMigrationUtils') return { toPn: () => phone };
      throw new Error('Missing module');
    },
    WWebJS: {
      getContact: async () => ({ id: lid, userid: lid.user }),
      enforceLidAndPnRetrieval: async () => {
        if (retrievalFailure) throw new Error('Lookup unavailable');
        return { phone };
      },
    },
  };
  t.after(() => { globalThis.window = previous; });
};

test('privacy ID returned by getContact does not prevent real phone retrieval', async (t) => {
  setup(t);
  assert.deepEqual(await resolvePhoneInPage(lid._serialized), {
    phone: phone.user, source: 'enforceLidAndPnRetrieval',
  });
});
test('failed contact lookup and failed retrieval still allow the final fallback', async (t) => {
  setup(t, { contactFailure: true, retrievalFailure: true });
  assert.deepEqual(await resolvePhoneInPage(lid._serialized), { phone: phone.user, source: 'toPn' });
});
test('actual phone sender works even without the contact store', async () => {
  assert.deepEqual(await resolvePhoneInPage('919876543210@c.us'), { phone: phone.user, source: 'sender' });
});
test('unresolved privacy IDs are never forwarded as phone numbers', async (t) => {
  setup(t);
  window.WWebJS.enforceLidAndPnRetrieval = async () => ({ phone: lid });
  const originalRequire = window.require;
  window.require = (name) => name === 'WAWebLidMigrationUtils' ? { toPn: () => lid } : originalRequire(name);
  assert.equal(await resolvePhoneInPage(lid._serialized), null);
});
