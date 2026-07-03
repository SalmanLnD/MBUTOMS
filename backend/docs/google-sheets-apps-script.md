# Google Sheets Timetable Sync (Apps Script)

No Google Workspace admin required. You create a normal Google Sheet and paste a
small script that pulls timetable data from TOMS every 5 minutes.

## Quick setup

### 1. Create a Google Sheet

1. Go to https://sheets.google.com while signed in as `mbu.campusmanager@faceprep.in`
2. Create a blank spreadsheet (name it e.g. **MBU Timetable**)
3. Copy the sheet URL from the browser address bar

### 2. Link from the TOMS app

1. Open **Timetable** in TOMS (admin or campus manager)
2. Click **Link to Sheets**
3. Follow the steps in the modal:
   - Click **Copy script**
   - In the sheet: **Extensions → Apps Script**
   - Delete sample code, paste the script, click **Save**
   - Select function **installTriggers** → **Run** (authorize when asked)
   - In the sheet, use menu **TOMS Timetable → Refresh now** to test
4. Paste your sheet URL in the modal → **Save link**

### 3. Open the live sheet

After linking, click **Open Sheet** on the Timetable page.

The sheet refreshes:

- Every **5 minutes** automatically
- Immediately when you use **TOMS Timetable → Refresh now** in the sheet menu

## Important: API must be reachable from Google

Apps Script runs on Google servers. It **cannot** call `localhost`.

| Environment | What to set |
|-------------|-------------|
| **Production** | `API_PUBLIC_URL=https://your-deployed-api.com` in backend `.env` |
| **Local testing** | Use a tunnel (e.g. ngrok) and set `API_PUBLIC_URL` to the public URL |

Without `API_PUBLIC_URL`, the setup modal shows `http://localhost:5000/...` which
only works if you expose that port publicly.

## How it works

- TOMS exposes read-only data at `GET /api/sheets/timetable/export?key=...`
- The API key is generated automatically and embedded in the Apps Script
- Edits in TOMS appear in the sheet after the next refresh (up to 5 min)
- The sheet is **view-only for viewers** if you share it that way in Google Sheets
- Changes typed **in the sheet do not** update TOMS (one-way sync)

## Troubleshooting

### Script error: API error 401

The API key in the script does not match the server. Open **Sheet setup** in TOMS,
copy the script again, and replace the code in Apps Script.

### Script error: connection failed / cannot reach host

`API_PUBLIC_URL` is wrong or the backend is not reachable from the internet.
Set the correct public URL and update the script from **Sheet setup**.

### Menu "TOMS Timetable" does not appear

Reload the spreadsheet, or run `onOpen` once from Apps Script editor.
