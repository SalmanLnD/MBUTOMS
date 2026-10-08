# TOMS photo punch-in

Screen: `/punch-in`, available only to administrators after login.

Punch-in is live by default. It captures a camera JPEG with coordinates, accuracy, server-issued
capture time and an IST stamp, uploads it to Drive, and records real attendance. There is no
preview or upload-only endpoint. `PUNCH_ATTENDANCE_ENABLED=false` disables the feature with an
error instead of simulating success. The administrator confirmed centre 13.621069, 79.289828;
environment coordinates can override this default.

## University Google Drive setup

Use one dedicated admin/university Google account. Enable the Google Drive API and configure
an OAuth client with offline access and `https://www.googleapis.com/auth/drive.file` consent.
Store the resulting credentials in server environment secrets, never frontend code or Git:

- `PUNCH_GOOGLE_CLIENT_ID`
- `PUNCH_GOOGLE_CLIENT_SECRET`
- `PUNCH_GOOGLE_REFRESH_TOKEN`
- Optional `PUNCH_DRIVE_ROOT_FOLDER_ID`: an app-accessible folder named `toms punch ins`.

The API creates `toms punch ins` when no root ID is supplied, then `YYYY-MM-DD` subfolders in IST.
Images are uploaded as private JPEG files. It does not grant public Drive permissions.
An existing linked Sheets document or a Google connector session does not authorize the deployed
TOMS backend to upload to Drive; this separate OAuth setup is required. No Drive account is
connected or folder created automatically during prototype development.

## Controlled live pilot

Set `PUNCH_CAMPUS_LATITUDE` and `PUNCH_CAMPUS_LONGITUDE` to the confirmed centre.
Radius is fixed at 1,500 metres. GPS accuracy must be at most 100 metres; distance plus
reported uncertainty must fit inside the radius. Readings expire after 60 seconds.

Set `PUNCH_IPINFO_TOKEN` to an IPinfo plan/token that returns `privacy.vpn`, `privacy.proxy`
and `privacy.tor`. Missing or failed reputation checks block live capture and submission.
Loopback/private client addresses are unknown. The implementation uses Express `req.ip`, not
untrusted forwarded headers. Configure trusted proxy handling for the actual deployment only
after verifying the ingress strips/replaces client-supplied forwarding headers.

Configure the above services and link the administrator to their trainer record before use.
Missing Drive credentials or network verification blocks capture; it never falls back to a test.
Impersonated/demo accounts cannot punch in. An admin without a linked trainer cannot mark
attendance for someone else through this screen. Set `PUNCH_ATTENDANCE_ENABLED=true` or remove
an old `false` value on the hosted backend to enable the feature.

After Drive confirms the upload, the API adds an earliest punch timestamp, Drive reference,
GPS metadata and image hash to `TrainerDailyAttendance`. No image bytes/base64 are stored in
MongoDB. Existing leave/attendance categories and existing punches are preserved. Duplicate
daily punches are rejected. If upload succeeds but the database write fails, the response
identifies the uploaded file for an administrator to reconcile; retries must be reviewed.

## Limits

- Browser GPS, camera selection and IP reputation cannot guarantee no VPN, no location
  spoofing, live capture authenticity or the identity of the person in the image.
- File validation checks JPEG framing/dimensions/size. Client lighting checks reject blank/dark
  captures. There is no face match, anti-replay/liveness model or full server-side image decoder.
- The visible stamp is burned into the JPEG. It is not GPS EXIF metadata or a satellite map.
- Network checks send the connection IP to the configured reputation provider. Photos and
  location are sent to university Drive only in live mode after the user submits.
- Capture requires HTTPS or localhost, explicit camera/GPS permissions, and a device that
  provides sufficiently accurate GPS. Desktop Wi-Fi geolocation may fail the accuracy check.
- The existing WhatsApp bridge remains available during the pilot; this prototype does not
  disable or migrate it. Production rollout needs real-device, OAuth, geofence and VPN pilot tests.

Sources: [Drive folders and uploads](https://developers.google.com/workspace/drive/api/guides/create-file),
[camera permissions](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia),
[GPS accuracy](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition).
# Local live trial (7 October 2026)

The administrator confirmed campus centre 13.621069, 79.289828 and authorized real attendance on localhost without VPN verification. Local `.env` enables `PUNCH_ATTENDANCE_ENABLED=true` and `PUNCH_LOCAL_TRIAL_ALLOW_UNVERIFIED_NETWORK=true`. The latter only accepts direct loopback requests with a localhost host in a non-production environment and rejects forwarded requests. It does not enable a network exception on deployed or LAN traffic. Known VPN/proxy flags still block capture and submission.

Live submission uploads the photo to the admin Drive before saving attendance metadata and the selected OIF. Duplicate punches and existing non-OIF attendance entries are rejected. Tests mock Drive and database writes; a real photo punch must be performed by the user on the page.
