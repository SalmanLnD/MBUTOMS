# TOMS installation and device notifications

The download icon in the top bar opens **TOMS on this device**. Users can add a dashboard shortcut and explicitly enable or disable notifications for their signed-in account on that browser/device.

## Install

- Chrome/Edge and supported Android browsers offer a native install prompt when available. Otherwise the panel gives browser-menu instructions.
- iPhone/iPad: open TOMS in Safari → Share → Add to Home Screen. On iOS/iPadOS 16.4 or later, open the installed app and choose Enable notifications.
- The manifest launches `/dashboard` in standalone mode. Authentication still applies; a signed-out user must log in. The service worker does not cache private pages or API data, so installation does not provide offline access.
- Use HTTPS in production. `localhost` is allowed for development, but an HTTP LAN address viewed from a phone is not a secure context.

## Backend setup

1. In `backend`, run `npx web-push generate-vapid-keys --json` **once**.
2. Set these backend environment variables locally and on the API host:
   - `WEB_PUSH_PUBLIC_KEY`: generated public key.
   - `WEB_PUSH_PRIVATE_KEY`: generated private key. Keep secret; never place in `VITE_*` or commit it.
   - `WEB_PUSH_SUBJECT`: real administrator `mailto:` contact or the public HTTPS TOMS URL.
3. Keep the key pair across deployments. If deliberately rotated, users must disable and re-enable notifications.
4. Deploy frontend public files including `sw.js`, the manifest, and icons as static files (not SPA HTML). Serve `sw.js` with `Cache-Control: no-cache`.

Without valid matching keys and a contact URL, the panel reports that server setup is pending and never requests notification permission.

## Delivery and access

Existing new inbox notifications (ticket changes, replacement assignments/cancellations, observations, tracker alerts, manager edits) also send encrypted Web Push to opted-in devices belonging to the recipient. The model's `save`/`insertMany` hooks cover the existing notification writers. Read-state updates do not push again. There is no all-user broadcast or new scheduled reminder job.

`GET /api/notifications/push/config`, `POST /api/notifications/push/subscription`, and `DELETE /api/notifications/push/subscription` require authentication. Configuration returns only the public key. Impersonation cannot change subscriptions. Delivery checks active users and session versions, and expired subscriptions are removed on push-service 404/410 responses. A delivery failure leaves the in-app alert intact.

Disabling/logout revokes the browser subscription and removes its account binding. Worker identity checks prevent stale notifications from exposing another account's message; stale/malformed pushes display a generic TOMS notice. Clicking a notification opens the relevant same-origin page or dashboard. Subscriptions to arbitrary/private endpoints are rejected.

## Verification

Automated tests mock push delivery, never contact real devices. Run backend `node --test tests/unit/webPush.test.js`, frontend `npm test`, and frontend `node scripts/check-device-features.mjs` (with the existing Playwright/Chrome environment paths when needed).

After setting production keys, verify on a real desktop browser, Android and installed iOS app: enable from the button, create a normal alert for a test account from another account, close TOMS, confirm receipt and deep link, turn off, and verify logout stops delivery. OS/browser policies and connectivity determine final delivery timing. Native iOS/Android install prompts and real push-service delivery require physical-device acceptance testing.

References: [WebKit iOS Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [MDN installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [web-push library](https://github.com/web-push-libs/web-push).
