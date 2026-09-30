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
