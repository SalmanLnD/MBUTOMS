# Responsive checks

Start the frontend with `VITE_API_URL=/api` and run Vite on a local port. Set
`RESPONSIVE_BASE_URL` if that port differs from `http://127.0.0.1:5176`.

Run `npm test` for the viewport positioning tests and `npm run build` for the
production build. The browser checks use Playwright:

```text
npm run test:responsive
npm run test:interactions
npm run test:modals
npm run test:page-dialogs
npm run test:modal-stack
```

Install Playwright in your development environment or set
`PLAYWRIGHT_MODULE_PATH` to its `index.mjs`. Set `CHROME_PATH` to an installed
Chrome/Chromium executable if Playwright's bundled browser is unavailable.
`RESPONSIVE_OUTPUT` selects the screenshot/report directory; the default is
the ignored `.tmp/responsive` directory.

These checks use a synthetic admin account and intercept API requests with
fixtures. They do not require production credentials. The authenticated checks
reject writes, including attendance autosaves. Only a localhost base URL is
allowed. The route sweep checks 14 routes at seven viewport sizes; the
interaction suite checks navigation, scrollable dialogs, tabs, dropdowns,
dark mode, and public pages. Screenshots support visual review; automated
overflow checks alone do not prove every possible screen or dataset fits.

The modal audit mounts the actual modal components through a development-only
entry at `scripts/ui-audit/index.html`, using the same contexts and styles as
the app. It checks add/edit/transfer variants at four sizes, scrolls each control
into view, and verifies that unmounting releases the body scroll lock. The page
dialog suite opens dialogs through the real page buttons and closes them through
their normal controls. Neither suite submits a form. The harness is excluded
from the production build, which has only the main application entry.

## Pending actions and attendance performance

`npm run test:pending-actions` holds real form/button promises and API responses.
It verifies click/Enter deduplication, locked dialog close routes, external submit
buttons, independent actions, draft preservation after failure, and the real
leave form with a synthetic conflict/retry. `npm run test:attendance-actions`
checks pagination/search, unchanged-cell saves, independent writes, failure retry,
rapid month changes, and direct PLP links. All API data is synthetic and all base
URLs must be localhost.

`npm run test:performance` measures three fresh-browser attendance trials using
60 trainers and 30 days. Set `PERFORMANCE_OUTPUT` to save a comparison report.
This is a local UI fixture benchmark, not a production API/database benchmark.
The development-only async-actions fixture and UI-audit entry are excluded from
the production build.

For manual review without a database, run `node scripts/review-preview.mjs`, then
start Vite on port 5178 with `VITE_API_URL=http://127.0.0.1:5001/api`. The preview
API binds only to localhost and stores sample leave/attendance edits in memory.
It deliberately delays saves so loading/double-click behavior is easy to inspect;
all other writes are disabled. Restarting it discards the sample edits.
