import test from 'node:test';
import assert from 'node:assert/strict';
import { scrapeGroupMessagesInPage } from '../groupHistory.js';

const message = (id, t) => ({ id: { _serialized: id }, t, type: 'image', caption: 'OIF CT27005', author: '919876543210@c.us' });
const setup = (t, load) => {
  const chat = { id: { _serialized: 'group@g.us' }, msgs: { getModelsArray: () => [message('new', 300)] } };
  const previous = globalThis.window;
  globalThis.window = {
    require(name) {
      if (name === 'WAWebCollections') return { Chat: { get: () => chat }, Contact: { find: async () => ({}) } };
      if (name === 'WAWebWidFactory') return { createWid: (id) => id };
      if (name === 'WAWebChatLoadMessages') return { loadEarlierMsgs: (args) => {
        assert.deepEqual(args, { chat });
        return load();
      } };
      throw new Error(`Unavailable: ${name}`);
    },
  };
  t.after(() => { globalThis.window = previous; });
};

test('catch-up loads older punches using the supported { chat } API', async (t) => {
  setup(t, () => [message('earlier-punch', 200), message('before-window', 50)]);
  const result = await scrapeGroupMessagesInPage('group@g.us', 100, 400, 12);
  assert.equal(result.historyComplete, true);
  assert.equal(result.historyError, null);
  assert.deepEqual(result.messages.map((row) => row.id), ['earlier-punch', 'new']);
});
test('history errors report incomplete coverage while keeping current punches', async (t) => {
  setup(t, () => { throw new Error('History unavailable'); });
  const result = await scrapeGroupMessagesInPage('group@g.us', 100, 400, 12);
  assert.equal(result.historyComplete, false);
  assert.match(result.historyError, /History unavailable/);
  assert.equal(result.messages.length, 1);
});
test('exhausted history finishes without repeatedly requesting empty pages', async (t) => {
  let calls = 0;
  setup(t, () => { calls += 1; return []; });
  const result = await scrapeGroupMessagesInPage('group@g.us', 100, 400, 12);
  assert.equal(result.historyComplete, true);
  assert.equal(calls, 1);
});
