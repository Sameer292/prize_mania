# Prize Mania

A private lucky draw studio using React, TypeScript, Tailwind CSS, Vite, and Bun. No backend, database, or account required.

## Run

```sh
bun install
bun run dev
```

## Draw workflow

1. Upload separate real and display-only (fake) CSVs. The studio has a downloadable template.
2. Add or edit gift names and images; use the arrows to assign gift order to round order.
3. Prepare the draw to randomly assign every participant to exactly one round, with at least one real entrant in each.
4. Spin each round, advance after the winner is revealed, and export winners from the Winners screen.

Required CSV headers, in any order and capitalization:

```csv
Coupon code,Participant name,Phone number,week number,status,Activated at
REAL-001,Asha Sharma,9800000001,1,Activated,2026-09-01
```

All uploaded real entries are eligible, regardless of status or week. Duplicate coupon codes (ignoring case/outer spaces) or phone numbers (ignoring formatting and normalizing international 00 prefixes) are rejected. Fake imports that overlap the real list are rejected in full, leaving existing data unchanged. Replacing the real list with overlapping data removes the old fake list and shows a notification.

## Round and winner rules

There is one round and one winner per gift. Typical group sizes round to the nearest ten: 200 participants / 5 gifts gives 40, 40, 40, 40, 40; 220 / 6 gives 40, 40, 40, 40, 40, 20. The remainder stays in the final round; if rounding would leave fewer than two people there, groups are rebalanced. You need at least as many real entrants as gifts, and at least one more total participant than gifts.

Shuffling and selection use browser cryptographic randomness with rejection sampling to avoid modulo bias. Winners are random **among real entrants in their assigned round**. Fake entries never win. Participants never repeat between rounds. The outcome is saved before animation so a refresh cannot reroll it. Setup is locked until the draw is reset.

## Storage and deployment

Data and gift images stay in this browser's local storage. Use the same browser and site address to resume. Clearing site data removes the draw. Export results before resetting. Unreadable saved data can be downloaded as a raw backup before clearing it.

CSVs can be up to 3 MB; PNG/JPEG/WebP gift images up to 800 KB. Browser storage quotas also apply; failed saves preserve the previous draw. Google Fonts supplies typography, with system fonts as a fallback. No participant data or gift image is sent to a server.

```sh
bun run test
bun run lint
bun run build
bun run preview
```

Deploy the generated dist/ directory to any static host. Use HTTPS outside localhost for browser cryptographic APIs.
