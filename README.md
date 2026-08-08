# Handoff: Ribbet — wedding guest app, couple intake, and Google-backed data

## Overview

Ribbet replaces the traditional wedding website. A couple buys it, connects a Google account, answers an intake form, picks a look, and Ribbet generates:

1. **A guest app** at `ribbet.app/<slug>` — mobile web, five tabs, sections the couple chose.
2. **A Google Drive folder** — the private photo vault every guest upload lands in.
3. **One Google Sheet** — five tabs, each designed to be handed to a different vendor.

The product's premise: *the couple's data lives in the couple's Google account.* Ribbet writes to it. Cancelling Ribbet does not delete the wedding.

Target platform for implementation: **Vercel** (Next.js App Router assumed unless the team prefers otherwise).

## About the Design Files

The `.dc.html` files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy. Recreate them in the target codebase using its established patterns and libraries. If no codebase exists yet, Next.js (App Router) + Tailwind on Vercel is the recommended stack, and these files are the visual spec.

Each file is self-contained: inline styles, a small logic class, no build step. Read them for exact values; do not port the runtime.

## Fidelity

**High-fidelity.** Colors, typography, spacing and interactions are final. Recreate pixel-accurately. Two exceptions, both marked in the docs below: (a) photo placeholders are flat gradient blocks awaiting real imagery, (b) the map on Travel & stay is a hand-drawn SVG stand-in for a real map embed.

---

## Recommended architecture on Vercel

```
Next.js (App Router) on Vercel
├── app/(marketing)/…              Stage 1 — sales page (NOT YET DESIGNED)
├── app/(intake)/setup/…           Stage 2+3 — intake wizard (Ribbet Intake.dc.html)
├── app/[slug]/…                   Stage 4 — the generated guest app
├── app/[slug]/console/…           Couple console (optional; the Sheet is the primary console)
└── app/api/…                      Route handlers
```

| Concern | Recommendation |
|---|---|
| Hosting | Vercel. `app/[slug]` is a dynamic route; each wedding is a row, not a deployment. Do **not** deploy per couple. |
| Auth (couple) | Auth.js, Google provider. **Exactly one API scope: `drive.file`.** Do not add `spreadsheets` — see "The scope decision" below. Store the refresh token encrypted. |
| Auth (guest) | Phone + 4-digit SMS code (designed, currently parked — see "Parked work"). Session cookie scoped to the household. |
| Database | Vercel Postgres or Neon. Holds weddings, households, guests, RSVPs, pledges, requests. The Sheet is a *mirror*, not the source of truth. |
| Sheet sync | Debounced writer (~10s) via a serverless route + queue. Two-way on exactly two columns: thank-you `Sent` and `Paid`. Everything else is one-way, app → Sheet, and those ranges are protected in the Sheet. |
| Photo vault | Direct-to-Drive resumable uploads, session URI minted server-side. Files never touch Vercel. Full spec in "Where the photos live". |
| SMS | Twilio. Invites and reminders only; manual send, no automated cadence (a product decision, not a technical one). |
| Payments (gifts) | **None in-app.** Guests pledge; the app deep-links to the couple's Venmo/Zelle. No PCI scope, no payout ledger. Do not add Stripe without revisiting this. |
| Real-time | Schedule/venue/menu changes push to guests. Vercel doesn't do long-lived sockets well — use Pusher/Ably, or poll on focus + a `revalidateTag` on the wedding. |
| Images | `next/image`; vault originals stay in Drive, thumbnails cached. |

### The scope decision (read this before touching auth)

Google sorts OAuth scopes into non-sensitive, sensitive, and restricted. `https://www.googleapis.com/auth/drive.file` is **non-sensitive** — basic verification only, no security assessment, no consent-screen warning, no 100-user testing cap. `spreadsheets` is **sensitive** and drags you into a review that takes weeks.

You do not need `spreadsheets`. `drive.file` grants access to files *the app itself created*, and the Sheets API operates fine on a spreadsheet your app created under that scope. So:

- Create the spreadsheet with the Sheets API while holding only `drive.file`.
- Every subsequent read/write on that same `spreadsheetId` is permitted.
- You can touch nothing else in the couple's Drive, which is precisely what the intake screen promises them.

**Never widen this.** If someone adds `drive` or `drive.readonly` to fix a bug, the product's onboarding story and its verification timeline both break.

### Provisioning spec — what happens when the couple presses "Build it"

Runs server-side, ~15s, no human involvement. Make it a single idempotent job keyed by `wedding_id` so a retry resumes rather than duplicates.

**0. Token.** OAuth returns access + refresh token. Encrypt the refresh token (AES-GCM, key in Vercel env) and store on the wedding row. Refresh before every later write — access tokens die hourly, a wedding lasts a year.

**1. Create the vault folder.**
```
POST drive/v3/files
{ name: "Amara & Cole — Photos", mimeType: "application/vnd.google-apps.folder" }
→ folderId
```

**2. Create the spreadsheet, tabs declared up front.**
```js
const sheet = await sheets.spreadsheets.create({
  requestBody: {
    properties: { title: `${n1} & ${n2} — Wedding Master` },
    sheets: [
      { properties: { title: "Guests & RSVP", gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: "Caterer",            tabColor: hexToRgb("#0f9d58") } },
      { properties: { title: "DJ list",            tabColor: hexToRgb("#7a4a86") } },
      { properties: { title: "Gifts & thank-yous", tabColor: hexToRgb("#b98d4f") } },
      { properties: { title: "Things to do",       tabColor: hexToRgb("#c26d5a") } },
    ],
  },
});
```
Only create tabs for sections the couple switched on — DJ list only if `sections.songs`, Gifts only if `sections.gifts`, Things to do only if `sections.around`. Guests & RSVP and Caterer are always created.

**3. One `spreadsheets.batchUpdate`** carrying every formatting request together:
- `updateCells` — header row per tab (exact column names are in the "The Google Sheet" section below)
- `repeatCell` — header style: bold, 11px, uppercase, `#f1f3f4` background, `#5f6368` text
- `updateSheetProperties` — freeze row 1 (and column A where the design shows a sticky row-number column)
- `updateDimensionProperties` — column widths matching the design's grid ratios
- `addProtectedRange` — **on every Ribbet-written column**, `warningOnly: false`, editors limited to the couple. Leave unprotected: thank-you `Sent`, gift `Paid`, and the whole Things to do tab.
- `updateCells` on Things to do A1 — a note reading "Type a place in the next row and it appears in your guests' app."

**4. File the Sheet into the folder.**
```
PATCH drive/v3/files/{sheetId}?addParents={folderId}&removeParents=root
```

**5. Add the partner as an editor.**
```
POST drive/v3/files/{sheetId}/permissions
{ role: "writer", type: "user", emailAddress: partnerEmail }
sendNotificationEmail: false   // send your own, branded
```
Same call against `folderId`.

**6. Domain.** If they chose their own: register via the registrar API, then attach to the Vercel project (`POST /v10/projects/{id}/domains`). Vercel issues the certificate. Middleware resolves `Host` → wedding row, so it is still one deployment. Register at *checkout*, not here, so DNS has propagated by the time they finish the form.

**7. Commit.** Write `drive_folder_id`, `sheet_id`, `published_at` to the wedding row and `revalidateTag(weddingId)`. Their link is live.

**Failure handling.** Each step records completion on the wedding row. A retry skips finished steps. If step 3 fails the couple must never be left with a half-built Sheet — either the job completes or the UI stays on "still building" with a support path.

### Where the photos live

**One folder in the couple's own Drive, dated subfolders inside it, originals untouched.**

```
📁 Amara & Cole — Photos          ← created at provisioning, owned by the couple
   📁 Before the day              ← anything uploaded before the wedding date
   📁 October 10                  ← the day itself
   📁 After                       ← honeymoon, brunch, stragglers
   📄 _who-sent-what.csv          ← guest ↔ file map, refreshed nightly
```

**How a photo gets there.** The guest's phone uploads *directly to Drive*, never through Vercel:

1. Guest taps upload → app requests a slot from `POST /api/vault/slot`.
2. Server refreshes the couple's token, calls Drive's **resumable upload** endpoint, gets back a session URI scoped to that one file, returns it to the phone.
3. Phone PUTs the bytes straight to Google. Serverless body limits never come into it, and a 40MB burst from a rooftop doesn't touch your bandwidth bill.
4. On completion the phone reports the `fileId`; server writes a `photos` row (wedding, household, fileId, takenAt) so you can answer "who sent this" without reading Drive.
5. Uploads queue in IndexedDB when offline and drain on reconnect — the guest app says so explicitly.

**Quality is non-negotiable — never compress.** The original file leaves the guest's phone and lands in Drive byte-identical. No resizing, no re-encoding, no stripping EXIF. Specifically:

- Upload the file the picker hands you. Do **not** pass it through a canvas, a resize library, or an image CDN on the way in.
- Request full-quality from the OS picker (iOS Safari will hand back a downscaled copy if you let it — set the input to accept the original, and test on a real iPhone with a HEIC live photo).
- Accept HEIC/HEIF as-is. Convert for *display* only, never for storage.
- Preserve capture timestamp and orientation metadata — it's what sorts the album and what makes the archive worth having in ten years.
- Drive's "Storage saver" setting must not be applied to this folder.

Compression is not a fallback for a full Drive either. If the couple is short on space, the answer is Google One, and the intake says so in those words. Shipping a wedding a folder of soft 8MP JPEGs would be a quiet betrayal of the one thing they can't re-shoot.

**What's stored where.** Original full-resolution files: Drive only. Your database holds ids and metadata, never image bytes. Thumbnails: generated on demand via Drive's `thumbnailLink` and cached at the edge — don't re-host originals, and never serve a thumbnail where a download is expected.

**Who can see them.** Nobody but the couple. The folder inherits no sharing. Guests see only their own uploads, which you serve by filtering `photos` on their household id — the guest app has no listing endpoint that returns another household's files. This is a product promise made on screen 04; enforce it server-side.

**Storage.** Because nothing is compressed, these land heavy in the couple's free 15GB Drive quota — shared with their Gmail. Estimate at intake using **~22 photos per guest × ~4.2MB**; an 86-guest wedding is roughly 8GB, a 200-guest wedding blows past the free tier. The intake screen shows this as a live meter against the 15GB line and recommends Google One (~$2/mo, 100GB) when it's tight — see the storage block on step 3 of `Ribbet Intake.dc.html`.

**Do not silently fail an upload because their Drive is full.** Check `about.get` storage quota before minting an upload slot; if there's no room, tell the guest their photo is queued and alert the couple immediately by text. An upload failing quietly during the reception is the worst bug this product can have.

**After the wedding.** The folder is already theirs; there's nothing to migrate. Ribbet stops writing, that's all. The console offers "Download everything" (Drive's native zip export) and, if they cancel, a final `_who-sent-what.csv` so the guest attribution survives without us.

---

### Ongoing sync

- **App → Sheet:** debounce ~10s, then one `values.batchUpdate`. Eighty guests replying on a Sunday afternoon must collapse into a handful of calls, not eighty.
- **Sheet → app:** poll the two unprotected columns (thank-you `Sent`, gift `Paid`) every few minutes, or on console open. Ticking in the Sheet and ticking in the app must both work.
- **Quota:** Sheets API allows 300 write requests/min/project. Batch accordingly; queue per wedding.

---

### Data model sketch

```
weddings         id, slug, owner_google_sub, name_one, name_two, date, venue,
                 guest_estimate, layout, palette, accent, sections jsonb,
                 drive_folder_id, sheet_id
households       id, wedding_id, label, phone, invite_sent_at, opened_at
guests           id, household_id, name, is_child, plus_one_of
rsvps            household_id, reply, attending_count, note, shuttle, submitted_at
guest_meals      guest_id, main, dietary[], kitchen_note
pledges          id, household_id, item, amount_cents, paid, address,
                 thanked, thanked_at
song_requests    id, household_id, title, artist
places           id, wedding_id, name, category, neighborhood, walk, blurb
photos           id, wedding_id, household_id, drive_file_id, taken_at
```

`sections` is a jsonb map of the 12 section keys → boolean. Locked-on keys (`home`, `rsvp`, `day`) are enforced server-side, not just in the UI.

---

## Screens / Views

### Stage 2+3 — Intake wizard
**File:** `Ribbet Intake.dc.html`
**Layout:** 880px card (fixed 860px tall, internal scroll) + 340px live phone preview to the right, 36px gap. Card has 2px `#201e1d` border, `0 24px 60px rgba(0,0,0,.18)` shadow.

**Step rail** (top of card, `border-bottom: 2px solid #201e1d`): five equal buttons, each with a 24px circular number badge and a label + sub-label. Active step: background `#201e1d`, white text. Completed: badge fills with the accent color and shows `✓`. Steps 2–5 are unreachable (opacity `.4`, `cursor: default`) until Google sign-in succeeds — enforce this server-side too.

1. **Google** — 38px Fraunces headline, three bordered cards (Drive folder / spreadsheet / it stays yours) with 20px stroke icons. Google button: white, 2px `#201e1d` border, official 4-color G mark, 15px/800 label. On success it swaps to a green-bordered account card (42px avatar, email, "Ribbet folder created in Drive") plus the continue CTA. **Copy the permissions sentence verbatim** — it's a promise the `drive.file` scope actually keeps.
2. **Details** — names (2-up), date + guest count (2-up), venue (full width). Inputs: 12px padding, 2px `#201e1d` border, no radius. Then a bordered block for the app name: `ribbet.app/` prefix + input; a note underneath in `#b8240e`/800 when short (<4 chars) or taken, otherwise 65% opacity. Three tap-to-use suggestions built from the names and the year parsed out of the date field.
3. **Sections** — 2-column grid of 12 toggles. Each: 20px checkbox (fills with accent), 14px/800 label, 11.5px sub-line. `home`, `rsvp`, `day` are always on and non-interactive, tagged "Always on". Below, a Sheets card showing which tabs the current picks produce.
4. **Design** — three layout cards side by side, each with a real themed preview swatch (the couple's names in that layout's serif, an accent rule, uppercase meta). Selected: 2px `#201e1d` + shadow. Then six palette chips (three 19×30px color bars + name) and eight accent squares (30px; selected gets a 3px dark border).
5. **Build** — five checklist rows that fill with the accent on "Create it". After: the live URL in 26px accent Fraunces, copy/import buttons, and a Drive card naming the Sheet.

**Live preview phone** (340×736): renders the chosen layout, palette, names, date, venue in real time. This is the point of the step — it is the app, not a mockup of it.

### Stage 4 — Guest app
**File:** `Ribbet App Structure.dc.html` — ten screens, 390×844 each.

| # | Screen | Notes |
|---|---|---|
| 01 | Home | Date eyebrow, 44px names, accent rule, 3-cell stat strip (days/seats/to-do), to-do list, couple's note in italic serif |
| 02 | RSVP | Household-level: one reply covers everyone. Per-person rows, then meal, dietary, kids, shuttle, plus-one request, song, note |
| 03 | The Day | Live schedule — past rows at 42% opacity, current row tinted with a 3px accent left border and a "Now" pill. Table card below |
| 04 | Photos | Uploads go to the couple's vault; guest sees only their own. 3-col grid. Offline queue messaging |
| 05 | More | 2-col card grid, 20px stroke icons, 8 sections |
| 06 | Gifts | Fund progress bar, item rows with Pledge buttons, Venmo/Zelle deep links |
| 07 | Travel & stay | **Map is a placeholder SVG** — replace with a real embed. Room blocks with codes, shuttle times |
| 08 | Menu | Family-style starters, three mains with the guest's pick ticked, bar list |
| 09 | Guestbook & songs | Post-first moderation; one song request each |
| 10 | Wedding party & FAQ | 2-up bios, FAQ accordion rows |
| 11 | Around town | Category filters, place cards with walk time and the couple's own blurb. Fed by the Sheet's "Things to do" tab |

Tab bar: 5 equal columns, 16px stroke icons, 8px/800 uppercase labels, active in accent.

### The Google Sheet
**File:** `Ribbet Google Sheet.dc.html` — the couple's view, five tabs.

| Tab | Handed to | Columns |
|---|---|---|
| Guests & RSVP | nobody (couple only) | Household, Guests, Invite sent, Opened, Reply, Attending, Kids, Note |
| Caterer | the venue, view-only | Guest, Table, Main, Dietary, Kid, Kitchen note + a totals row pinned at the top |
| DJ list | the DJ, view-only | Song, Artist, Votes, Slot, Requested by + first-dance and do-not-play rows |
| Gifts & thank-yous | couple only | From, Gift, Amount, Paid, Address, Card sent, Sent on |
| Things to do | **couple writes this one** | Place, Category, Neighborhood, Walk, Why we love it → publishes to screen 11 |

Sheet chrome: green Sheets icon, "Ribbet sync on · last write 40 seconds ago", formula bar with an `Auto-filled by Ribbet — don't edit` chip, per-tab colored banner explaining the handoff.

Implementation notes: apply Sheets **protected ranges** to every Ribbet-written column so a vendor with edit access can't corrupt the source. Duplicate-song rollup into a vote count happens app-side, not with a Sheet formula.

**Per-tab sharing is the one thing Google doesn't do.** A share grants access to the whole spreadsheet, so a caterer with the link can read the gift column. Solve it by generating a **separate vendor spreadsheet** per handoff — a Caterer sheet and a DJ sheet, each created by Ribbet (so still `drive.file`), each holding only its own columns, refreshed by the same debounced writer. The couple shares that file, not the master. More API work, correct outcome.

---

## Interactions & Behavior

- Step navigation is gated on Google auth. Verify server-side.
- Slug availability: check on change, debounce 300ms. Reserved list plus a real uniqueness check. Minimum 4 characters.
- Section toggles rewrite both the guest tab bar and the Sheet's tab list live.
- Layout/palette/accent changes re-render the preview phone immediately — no apply button.
- "Create it" fills the checklist rows and reveals the live URL. Real implementation: create Drive folder → create Sheet → seed tabs → write wedding row → revalidate the slug route.
- Guest photo upload queues offline and sends on reconnect (rooftop wifi is the stated reason).
- Schedule change → one push per change, never more. The couple writes the message themselves; the app only suggests.
- Animations: `rbIn` / `gsIn`, `opacity 0→1` + `translateY(8-10px)→0`, 220–300ms ease. Progress bars transition `width` 350–500ms ease.

## State Management

Intake: `step`, `signedIn`, `built`, `n1`, `n2`, `date`, `venue`, `guestCount`, `slug` (null = derive from names), `layout`, `palette`, `accent` (null = palette default), `on{}` (section map). Persist to the DB on each step so a refresh doesn't lose progress.

Guest app: household session, RSVP draft, upload queue.

## Design Tokens

**Layouts** (`bg / panel / line / ink / muted / serif / radius`)
- Botanical — `#243528 / #2d4234 / #3d5142 / #e9e2d4 / #9aa793 / Fraunces / 0px`
- Classic — `#f6f3ee / #ffffff / #e0d8c8 / #2a2622 / #8a8378 / Cormorant Garamond / 0px`
- Romantic — `#fdf7f4 / #ffffff / #f0dcd2 / #4a3a34 / #a8938a / Libre Caslon Text / 14px`

**Palettes** (accent / light / deep)
Brass `#b98d4f #e9e2d4 #3d5142` · Terracotta `#c26d5a #f3d9cf #8a5346` · Sage `#7d9a6f #e4ebdd #4c6244` · Ink `#2f4a7c #dfe6f2 #1b2c4d` · Plum `#8d6fb9 #e8dff5 #5b4479` · Rust `#b4552f #f2dcd0 #7a3819`

Accent text color is computed: luminance `0.299R + 0.587G + 0.114B`, below 150 → `#ffffff`, else `#243528`.

**Chrome:** page `#e6e4e2`, borders `#201e1d` 2px, card shadow `0 24px 60px rgba(0,0,0,.18)`.
**Type:** Karla 400/700/800 (UI), Fraunces / Cormorant Garamond / Libre Caslon Text (display, per layout). Eyebrows: 9.5–11px, `letter-spacing: .22–.30em`, uppercase. Body 12–14px, `line-height` 1.5–1.65.
**Spacing:** 2 / 6 / 8 / 10 / 14 / 18 / 22 / 26 / 38 / 44px.
**Google green:** `#0f9d58`. **Google blue:** `#1a73e8`. **Error red:** `#b8240e`.

## Assets

All icons are inline SVG, 24px viewBox, `stroke-width` 1.7–1.8, round caps/joins — no icon library. The Google G mark uses the official four brand colors and must not be recolored. Photo placeholders are CSS gradients between `panel` and `line`; swap for real imagery. The Travel map is a hand-drawn SVG placeholder.

## Parked work

- **Vendor sheets** — generating the separate caterer/DJ spreadsheets described above.
- **Guest lock screens** (phone entry + 4-digit code) are designed and were removed from the current structure file at the user's request. They go back in front of Home before launch. One code per household.
- **Stage 1 sales page** — not designed yet, deliberately.

## Files

- `Ribbet Intake.dc.html` — stages 2, 3, 4 (intake, design selection, build) with live preview
- `Ribbet App Structure.dc.html` — all ten guest app screens
- `Ribbet Google Sheet.dc.html` — the couple's spreadsheet, five tabs
- `Ribbet.dc.html` — earlier working prototype: setup panel, contacts/SMS invite flow, and an in-app couple console. Useful for the contacts-permission flow and the console table, superseded elsewhere.
