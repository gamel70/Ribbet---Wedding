# Build it, then test it as a couple

Two parts. Part A is you setting things up (about 90 minutes, mostly waiting). Part B is you pretending to be Amara, buying the product and using it.

You do not need to know how to code. You need to be able to copy, paste, and read error messages out loud to Claude Code.

---

# PART A — Get it running

## A1. Make three accounts (25 min)

| Where | What to do | What to save |
|---|---|---|
| github.com | Sign up | — |
| vercel.com | Sign up **with GitHub** | — |
| neon.tech | New project, name it `ribbet` | The **connection string** (starts `postgresql://`) |

Paste those into a note. You'll need them twice.

## A2. Set up Google (25 min — the fiddly one)

1. Go to **console.cloud.google.com**
2. Top bar → project dropdown → **New Project** → name it `Ribbet` → Create
3. Left menu → **APIs & Services → Library**
   - Search "Google Drive API" → **Enable**
   - Search "Google Sheets API" → **Enable**
4. Left menu → **OAuth consent screen**
   - User type: **External** → Create
   - App name: `Ribbet`. Support email: yours. Developer email: yours. → Save and continue
   - Scopes page → **Add or remove scopes** → paste this in the filter box and tick it:
     ```
     https://www.googleapis.com/auth/drive.file
     ```
     **Only that one.** If you find yourself ticking anything else, stop — that's the thing that causes months of Google review.
   - → Save and continue
   - Test users → **Add users** → add your own Gmail, and a second Gmail if you have one (that'll be "Cole") → Save
5. Left menu → **Credentials → Create Credentials → OAuth client ID**
   - Type: **Web application**
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Create → copy the **Client ID** and **Client secret** into your note

> The "unverified app" warning you'll see later is normal and expected. You're a test user on your own app. Click "Advanced → Go to Ribbet (unsafe)". Real customers won't see this once you submit for basic verification, which is a form, not a security audit — because you only asked for `drive.file`.

## A3. Create the project (10 min)

Open Terminal (Mac: Cmd+Space, type "Terminal"). Paste one line at a time:

```
npx create-next-app@latest ribbet --typescript --tailwind --app --yes
cd ribbet
npm i next-auth @auth/core googleapis drizzle-orm @neondatabase/serverless
```

Then put the design bundle inside it: unzip the download you got and drag the `design_handoff_ribbet` folder into the `ribbet` folder.

## A4. Add your keys (5 min)

In the `ribbet` folder, create a file called `.env.local` and paste this, filling in your saved values:

```
DATABASE_URL=postgresql://...your neon string...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=paste-any-long-random-string-here
NEXTAUTH_URL=http://localhost:3000
```

## A5. Hand it to Claude Code (the actual build)

Install Claude Code, open it in the `ribbet` folder, and give it these prompts **one at a time**. Wait for each to finish and check the result before moving on.

**Prompt 1**
> Read design_handoff_ribbet/README.md completely. Then set up the database schema from the data model sketch using Drizzle, and set up Auth.js with the Google provider requesting ONLY the drive.file scope plus basic profile. Store the refresh token encrypted on the user record. Don't build any UI yet.

**Prompt 2**
> Build the intake wizard at /setup, recreating design_handoff_ribbet/"Ribbet Intake.dc.html" pixel-accurately in React and Tailwind. All five steps, the live phone preview, the storage meter, the domain picker. Save progress to the database on each step. Steps 2-5 must be unreachable until Google sign-in succeeds, enforced server-side.

**Prompt 3**
> Now implement the provisioning job from the "Provisioning spec" section of the README — the Drive folder, the spreadsheet with its tabs, the batchUpdate formatting and protected ranges, filing the sheet into the folder. Make it idempotent and keyed by wedding id. Wire it to the "Create it" button.

**Prompt 4**
> Build the guest app at /[slug], recreating screens 01-05 from design_handoff_ribbet/"Ribbet App Structure.dc.html". Read the wedding's layout, palette and accent from the database so it themes correctly.

**Prompt 5**
> Now screens 06-11, showing only the sections the couple switched on.

**Prompt 6**
> Implement the photo vault per "Where the photos live" — direct-to-Drive resumable uploads, no compression anywhere in the path, quota check before minting an upload slot.

After each prompt, run `npm run dev` and look at `http://localhost:3000`. If something's broken, copy the error and paste it to Claude Code. That's the whole debugging loop.

---

# PART B — Test it as a couple

Do this in order, and **actually try to break it**. You're looking for the moment you'd get confused if you weren't the person who built it.

## Test 1 — Sign up (you are Amara)

1. Open `http://localhost:3000/setup`
2. Click **Sign in with Google**, use your Gmail
3. Click through the unverified-app warning

✅ **Check:** Read the permission screen Google shows you. It should mention only files this app creates. If it asks for anything about your existing Drive files or your email content, stop — the scope is wrong.

## Test 2 — Fill in the intake

Use these, they match the design:
- Names: **Amara** and **Cole**
- Date: **Saturday, October 10, 2026**
- Guests: **86**
- Venue: **The Osprey Rooftop, Brooklyn**

✅ **Check the domain box** — it should have suggested `amaraandcole26.com` on its own.
✅ **Now type `love` into it.** It must go red and say taken.
✅ **Change guest count to 300.** The storage meter should jump into the red and start recommending Google One. Change it back to 86.

## Test 3 — Skip the rest

Click **Build it now — use your defaults**.

✅ **Check:** it goes straight to step 5. This is the ninety-second path most customers will take.

## Test 4 — The moment of truth

Click **Create it**.

Now open **drive.google.com** in another tab.

✅ You should see a folder: **Amara & Cole — Photos**
✅ And inside or beside it: **Amara & Cole — Wedding Master**
✅ Open that sheet. It should have five tabs along the bottom, each with proper headers — not an empty grid.
✅ Try typing in a protected column, like the Reply column. Google should stop you.
✅ Go to the **Things to do** tab. Type a restaurant in row 2.

## Test 5 — Be a guest

Open `http://localhost:3000/amaraandcole` (or whatever your link was) — ideally **on your phone**, on the same wifi, using your computer's local IP.

✅ Does it look like the design, in the right colors?
✅ Tap through all five tabs.
✅ Go to **More → Around town**. The restaurant you typed into the Sheet should be there.
✅ Submit an RSVP.

## Test 6 — Watch it land

Go back to the Google Sheet.

✅ Your RSVP should appear in the Guests & RSVP tab within about ten seconds.

**This is the product.** If Tests 4, 5 and 6 all pass, everything else is polish.

## Test 7 — Photos, carefully

1. On your phone, in the guest app, upload a photo you took with that phone
2. Open the Drive folder on your computer
3. Download the photo back
4. **Right-click → Get Info** on both the original and the downloaded copy

✅ **The file sizes must match.** If the downloaded one is smaller, something in the path is compressing it and must be found and removed.
✅ Photo should be in a dated subfolder, not loose.
✅ In the guest app, confirm you can only see your own uploads.

## Test 8 — Break it on purpose

- Turn on airplane mode, upload a photo, turn wifi back on → it should send when you reconnect
- Submit an RSVP, then go back and change it → the Sheet should update, not add a duplicate row
- Open the guest link in a private window → does it still work? (It should for now; the phone-code lock is deliberately parked)
- Fill in the intake but close the tab halfway → reopening `/setup` should remember where you were

---

## When it all passes

1. `vercel` in the terminal to deploy
2. Add every line of your `.env.local` into Vercel's Environment Variables, but change `NEXTAUTH_URL` to your real Vercel URL
3. Back in Google Cloud → Credentials → add the production redirect URI: `https://yourapp.vercel.app/api/auth/callback/google`
4. Test the whole of Part B again on the live URL
5. **Then** submit the OAuth consent screen for verification. With only `drive.file` this is a short form, not a security assessment — but start it before you have customers waiting.

## Still parked, on purpose

- **The guest login screens** (phone number + texted code). Designed, removed for now. Put them back before real guests get real links.
- **The sales page.** Not designed yet.
- **Vendor sheets** — separate caterer/DJ spreadsheets, because Google can't share a single tab.
