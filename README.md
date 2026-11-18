# Pocketta (web)

The web version of Pocketta: your money for the month, on any phone.
Daily allowance, bills and subscriptions, installments, gam'eya and loans.

- Works offline after the first visit, and can be added to the home screen (iPhone: Share → Add to Home Screen).
- All data stays on the phone, inside the browser (IndexedDB). There is no server and no account.
- Backup: Settings → Save backup gives a JSON file you can restore on another phone.

Plain HTML, CSS and JavaScript modules. No build step: GitHub Pages serves the files as they are.

## 1.3 (matches the Android 1.3 design)
- 3 tabs: Today, Spending, Commitments (bills, installments, gam'eya, loans). Settings and more are behind the gear.
- Today: colour-coded "you can spend today" card, quick add by typing a sentence, dollar/gold converter with daily rates, savings goal ring, Friday/Saturday week card, Start here guide.
- Spending: donut, expensive days, this month vs last month, share the month as a picture.
- Night mode (Auto / Light / Dark). Daily rates come from the `rates` branch of the Pocketta repo; your own rates still win.
- Existing data is kept: new settings are added with defaults when the app opens.

Deploy: GitHub Pages serves `main` (root). Merging to `main` publishes it; nothing else to run.
