import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fixture, user } from './responsive-fixtures.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href : 'playwright');
const base = process.env.RESPONSIVE_BASE_URL || 'http://127.0.0.1:5173';
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/);
const publicKey = Buffer.from([4, ...Array(64).fill(1)]).toString('base64url');
const trainer = { ...user, role: 'trainer', trainer: 'trainer-test' };
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
await mkdir('.tmp/device-features', { recursive: true });
try {
  for (const mode of ['desktop', 'android', 'ios', 'ios-installed', 'unconfigured', 'blocked',
    'setup-android', 'setup-manual', 'setup-denied', 'setup-unconfigured', 'setup-unsupported', 'setup-ios', 'setup-complete', 'setup-preview']) {
    const setup = mode.startsWith('setup-');
    const sessionUser = setup ? { ...trainer, appVersion: '2.2.2', ...(mode === 'setup-preview' ? { impersonating: true } : {}) } : trainer;
    const mobile = !['desktop', 'unconfigured', 'setup-manual', 'setup-complete'].includes(mode);
    const context = await browser.newContext({ viewport: { width: mobile ? 390 : 1366, height: 900 },
      ...(mode.includes('ios') ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' } : {}) });
    await context.addInitScript(({ u, mode, publicKey }) => {
      localStorage.setItem('toms_token', 'test'); localStorage.setItem('toms_user', JSON.stringify({ ...u, appVersion: '2.2.1' }));
      localStorage.setItem(`toms_sallu_notice:${u._id}:2.2.1`, 'seen');
      if (mode === 'desktop') localStorage.setItem('toms_theme', 'dark');
      if (mode === 'ios-installed' || mode === 'setup-complete') Object.defineProperty(navigator, 'standalone', { value: true });
      if (mode === 'setup-unsupported') delete window.PushManager;
      if (mode === 'setup-complete') localStorage.setItem('toms_push_device', JSON.stringify({ recipient: u._id, publicKey }));
      window.__device = { permissionCalls: 0, subscriptions: 0, unsubscribes: 0, subscription: null };
      let permission = mode === 'blocked' || mode === 'setup-denied' ? 'denied' : mode === 'setup-complete' ? 'granted' : 'default';
      Object.defineProperty(Notification, 'permission', { get: () => permission });
      Notification.requestPermission = async () => { window.__device.permissionCalls++; permission = 'granted'; return permission; };
      const makeSubscription = () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/test',
        toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/test', keys: { p256dh: 'test', auth: 'test' } }),
        unsubscribe: async () => { window.__device.unsubscribes++; window.__device.subscription = null; return true; } });
      if (mode === 'setup-complete') window.__device.subscription = makeSubscription();
      Object.defineProperty(ServiceWorkerRegistration.prototype, 'pushManager', { get: () => ({
        getSubscription: async () => window.__device.subscription,
        subscribe: async options => {
          window.__device.subscriptions++;
          if (!options.userVisibleOnly) throw Error('Push must be visible');
          const subscription = makeSubscription();
          window.__device.subscription = subscription; return subscription;
        },
      }) });
    }, { u: sessionUser, mode, publicKey });
    const writes = [];
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url()), path = url.pathname.replace(/^\/api/, '');
      if (path === '/notifications/push/subscription') writes.push({ method: route.request().method(), body: route.request().postDataJSON() });
      const data = path === '/auth/me' ? sessionUser : path === '/notifications/push/config' ? { configured: !mode.endsWith('unconfigured'), publicKey }
        : path === '/notifications/push/subscription' ? { enabled: route.request().method() !== 'DELETE' } : fixture(path, url.searchParams);
      await route.fulfill({ json: data });
    });
    const page = await context.newPage(), errors = [];
    let cdp, registrationId;
    if (mode === 'desktop') {
      cdp = await context.newCDPSession(page);
      cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
        const registration = registrations.find(item => item.scopeURL === base + '/');
        if (registration) registrationId = registration.registrationId;
      });
      await cdp.send('ServiceWorker.enable');
    }
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/dashboard');
    await page.evaluate(() => navigator.serviceWorker.ready);
    assert.equal(await page.evaluate(() => window.__device.permissionCalls), 0, 'Never prompt at page load');
    const manifest = await (await context.request.get(base + '/manifest.webmanifest')).json();
    assert.equal(manifest.start_url, '/dashboard'); assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.scope, '/', 'The installed app must include every TOMS page');
    assert.ok((await (await context.request.get(base + '/sw.js')).text()).includes("self.addEventListener('push'"));
    if (setup) {
      const setupDialog = page.getByRole('dialog', { name: 'Set up TOMS v2.2.2', exact: true });
      if (mode === 'setup-complete' || mode === 'setup-preview') {
        await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
        assert.equal(await setupDialog.count(), 0);
      } else {
        await setupDialog.waitFor();
        assert.equal(await setupDialog.getByRole('button', { name: 'Close', exact: true }).count(), 0);
        await page.keyboard.press('Escape'); assert.equal(await setupDialog.isVisible(), true);
        assert.equal(await page.evaluate(() => localStorage.getItem('toms_token')), 'test', 'A patch must not log out existing users');
        if (['setup-denied', 'setup-unconfigured', 'setup-unsupported'].includes(mode)) {
          const fallback = setupDialog.getByRole('button', { name: 'Continue without notifications', exact: true });
          await fallback.click();
          assert.equal(await page.evaluate(() => window.__device.permissionCalls), 0);
        } else if (mode === 'setup-ios') {
          assert.match(await setupDialog.innerText(), /Home Screen to finish setup/);
          assert.equal(await setupDialog.getByRole('button', { name: 'Continue to TOMS', exact: true }).isDisabled(), true);
          assert.equal(await setupDialog.getByRole('button', { name: 'Enable notifications', exact: true }).isDisabled(), true);
          await page.screenshot({ path: '.tmp/device-features/setup-ios.png' });
          await context.close(); continue;
        } else {
          const proceed = setupDialog.getByRole('button', { name: 'Continue to TOMS', exact: true });
          assert.equal(await proceed.isDisabled(), true);
          await setupDialog.getByRole('button', { name: 'Enable notifications', exact: true }).click();
          await setupDialog.getByRole('button', { name: 'Notifications enabled', exact: true }).waitFor();
          assert.equal(await proceed.isDisabled(), true, 'Both installation and notifications are required');
          if (mode === 'setup-android') {
            await page.evaluate(() => {
              const event = new Event('beforeinstallprompt', { cancelable: true });
              event.prompt = async () => { window.__installCalled = true; window.dispatchEvent(new Event('appinstalled')); };
              event.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(event);
            });
            await setupDialog.getByRole('button', { name: 'Add to Home Screen', exact: true }).click();
            assert.equal(await page.evaluate(() => window.__installCalled), true);
          } else {
            await setupDialog.getByRole('button', { name: 'Add to Home Screen', exact: true }).click();
            await setupDialog.getByRole('button', { name: "I've added the shortcut", exact: true }).click();
          }
          await page.screenshot({ path: `.tmp/device-features/${mode}.png` });
          await proceed.click();
          assert.equal(await page.evaluate(() => window.__device.permissionCalls), 1);
        }
        assert.equal(await setupDialog.count(), 0);
        assert.equal(await page.evaluate(() => sessionStorage.getItem('toms_device_setup_session:admin-test:2.2.2')), 'done');
        // Moving between layout branches must not repeat onboarding in the same session.
        if (mobile) {
          await page.getByRole('navigation', { name: 'Mobile navigation', exact: true }).getByRole('link', { name: 'Timetable', exact: true }).click();
        } else {
          await page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('link', { name: 'Timetable', exact: true }).click();
        }
        await page.waitForURL(base + '/timetable'); assert.equal(await setupDialog.count(), 0);
        if (['setup-denied', 'setup-unconfigured', 'setup-unsupported'].includes(mode)) {
          const nextSession = await context.newPage();
          await nextSession.goto(base + '/dashboard');
          await nextSession.getByRole('dialog', { name: 'Set up TOMS v2.2.2', exact: true }).waitFor();
          await nextSession.close();
        }
      }
      assert.deepEqual(errors, []); await context.close(); continue;
    }
    await page.getByRole('button', { name: 'Install TOMS and notifications', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'TOMS on this device', exact: true });
    await dialog.waitFor();
    const enable = dialog.getByRole('button', { name: 'Enable notifications', exact: true });
    if (mode === 'ios') {
      assert.match(await dialog.innerText(), /Share button/); assert.equal(await enable.isDisabled(), true);
      assert.match(await dialog.innerText(), /16.4/);
    } else if (mode === 'unconfigured' || mode === 'blocked') {
      await page.getByText(mode === 'blocked' ? /Notifications are blocked/ : /after server setup/).waitFor();
      assert.equal(await enable.isDisabled(), true);
    } else {
      await enable.click();
      await dialog.getByRole('button', { name: 'Turn off device notifications', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.__device.permissionCalls), 1);
      assert.equal(writes.filter(item => item.method === 'POST').length, 1);
      assert.equal(writes[0].body.publicKey, publicKey);
      if (mode === 'desktop') {
        assert.ok(registrationId, 'Worker registration must be active');
        const worker = context.serviceWorkers().find(item => item.url() === base + '/sw.js');
        await worker.evaluate(() => {
          self.registration.showNotification = async (title, options) => {
            const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
            clients.forEach(client => client.postMessage({ type: 'TOMS_TEST_SHOWN', title, options }));
          };
        });
        await page.evaluate(() => {
          window.__shown = [];
          navigator.serviceWorker.addEventListener('message', event => {
            if (event.data?.type === 'TOMS_TEST_SHOWN') window.__shown.push(event.data);
          });
        });
        await cdp.send('ServiceWorker.deliverPushMessage', { origin: base, registrationId, data: JSON.stringify({ recipient: trainer._id, id: 'push-1', body: 'Test replacement assigned', url: '/topic-tracker?date=2026-10-05' }) });
        await page.waitForFunction(() => window.__shown.length === 1);
        const shown = await page.evaluate(() => window.__shown[0]);
        assert.equal(shown.options.body, 'Test replacement assigned');
        assert.equal(shown.options.data.url, base + '/topic-tracker?date=2026-10-05');
        await cdp.send('ServiceWorker.deliverPushMessage', { origin: base, registrationId, data: JSON.stringify({ recipient: 'other-account', id: 'push-2', body: 'Private message', url: '//evil.test' }) });
        await page.waitForFunction(() => window.__shown.length === 2);
        const stale = await page.evaluate(() => window.__shown[1]);
        assert.equal(stale.options.body, 'Open TOMS to view your notifications.');
        assert.equal(stale.options.data.url, base + '/dashboard');
      }
      await dialog.getByRole('button', { name: 'Turn off device notifications', exact: true }).click();
      await enable.waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('toms_push_device')), null);
      assert.equal(await page.evaluate(() => window.__device.unsubscribes), 1);
      assert.equal(writes.at(-1).method, 'DELETE');
    }
    if (mode === 'android') {
      await page.evaluate(() => {
        const event = new Event('beforeinstallprompt', { cancelable: true });
        event.prompt = async () => { window.__installCalled = true; };
        event.userChoice = Promise.resolve({ outcome: 'accepted' });
        window.dispatchEvent(event);
      });
      await dialog.getByRole('button', { name: 'Add to Home Screen', exact: true }).click();
      assert.equal(await page.evaluate(() => window.__installCalled), true);
    } else if (!mode.startsWith('ios')) {
      await dialog.getByRole('button', { name: 'Add to Home Screen', exact: true }).click();
      await dialog.getByText(/Open your browser menu/).waitFor();
    }
    await page.screenshot({ path: `.tmp/device-features/${mode}.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    if (mode === 'ios-installed') {
      await page.getByRole('button', { name: 'Open all pages', exact: true }).click();
      const pages = page.getByRole('navigation', { name: 'All app pages', exact: true });
      const paths = await pages.getByRole('link').evaluateAll(links => links.map(link => link.getAttribute('href')));
      for (const path of ['/dashboard', '/trainers', '/subjects', '/timetable', '/venues', '/classes-students', '/leaves', '/tickets', '/topic-tracker']) {
        assert.ok(paths.includes(path), `Installed app navigation must include ${path}`);
      }
      await pages.getByRole('link', { name: 'Topic Tracker', exact: false }).click();
      await page.waitForURL(base + '/topic-tracker');
      await page.getByRole('button', { name: 'Open all pages', exact: true }).click();
      await page.getByRole('navigation', { name: 'All app pages', exact: true }).getByRole('link', { name: 'Dashboard', exact: false }).click();
      await page.waitForURL(base + '/dashboard');
    }
    if (mode === 'desktop') {
      await page.getByRole('button', { name: 'Install TOMS and notifications', exact: true }).click();
      await enable.click();
      await dialog.getByRole('button', { name: 'Turn off device notifications', exact: true }).waitFor();
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: 'Logout', exact: true }).click();
      await page.waitForFunction(() => !localStorage.getItem('toms_user'));
      assert.equal(await page.evaluate(() => window.__device.unsubscribes), 2);
      assert.equal(writes.at(-1).method, 'DELETE');
      await page.getByRole('button', { name: 'Install TOMS and notifications', exact: true }).click();
      await dialog.getByText(/Sign in to enable notifications/).waitFor();
      assert.equal(await dialog.getByRole('button', { name: 'Enable notifications', exact: true }).isDisabled(), true);
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('Desktop/mobile install controls, iOS install guidance, explicit permission, enable/disable, logout cleanup and static PWA assets passed (push APIs mocked).');
} finally { await browser.close(); }
