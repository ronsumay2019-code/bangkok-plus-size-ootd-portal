# Meta compliance (HARD RULE)

Owner, 26 Oct 2026: "Lets make sure we are ensuring our App is business compliant, and strictly avoiding this."
The owner's list of what gets Meta accounts restricted:

1. **Ad account or portfolio violations spread to the person.** A restricted ad account or portfolio often flags its admins' personal profiles too.
2. **Linked to a banned account.** Sharing a portfolio, app, payment method, device or IP with a banned account.
3. **App policy problems.** Breaking Platform Terms, misusing data, or failing a Data Use Checkup or verification. *(Owner repeated this one.)*
4. **Suspicious login patterns.** New devices, VPNs, logins from different countries, several people on one login. A profile run from the Philippines and used from Bangkok looks risky. *(Owner repeated this one.)*
5. **"Inauthentic" signals.** A new or thin profile that suddenly creates portfolios, apps or ad accounts.
6. **Name mismatch.** A profile name that doesn't match a real ID can't pass verification.

## Rules for every agent and every change (C1–C9)

| # | Rule | Status in the portal (checked 26 Oct) |
|---|---|---|
| C1 | Use only Meta's official Graph API with the Page key on the server. No scraping facebook.com, no browser automation, no personal Facebook logins or user tokens. | **Met.** Code search: Facebook pages appear only as links for people to click. |
| C2 | Never work around a Meta limit. Hidden buyer names stay hidden until Meta approves (a person opens the comment link). Agents never create apps, pages, portfolios or ad accounts. | **Met.** Hidden names are saved as "Name needed" with the comment link (L-006). |
| C3 | Messenger: the portal sends only within 24 hours of the buyer's last message, never with message tags, never bulk or promotional. A person approves every send. | **Fixed 26 Oct.** Before, the send had no 24-hour check. Now it refuses outside the window and says to reply from Meta Business Suite (`server/messengerWindow.ts`, test added). |
| C4 | Facebook data (names, comments, messages) never goes to an outside AI or service unless it delivers a feature the owner approved and the privacy policy names it. | **Fixed 26 Oct.** The removed Pola AI routes could send buyer names to Google Gemini; they now return "Removed". Groq receives only the audio of the Page's own replay video (service provider, must be in the privacy policy: OL-50). |
| C5 | Ask only for permissions the portal uses. | Partly unknown: `business_management` shows 8.4k API calls in the Messenger use case (owner screenshot); the caller is unknown (OL-51). `ads_management` is not added; the portal never touches ads. |
| C6 | Keys live only in Vercel settings, never in the database, files or chat. Webhooks are signature-checked. | **Open.** A copy of the Page key is still in the database (KI-005, OL-47). `META_APP_SECRET` is not set, so webhooks aren't signature-checked (KI-008). |
| C7 | Keep Facebook data only as long as the shop needs it, and delete it when a person asks. | **Open.** Retention period is an owner decision (OL-48). |
| C8 | Call Facebook politely: the portal reads every 30 s at most, captions every ~3 min, and slows down when Facebook says so. | Partly met. No slow-down on Facebook's "too many calls" errors yet (OL-49, after tonight). |
| C9 | One app (BPSO Clothing), one Page (Bangkok Plus Size OOTD). Never connect the other Pages listed in the owner's account without the owner. | **Met.** Owner chose "current Pages only" with one Page (26 Oct). |

## What only the owner can do (people side)

The portal already helps with risk 4: staff sign in with the portal's own links, so nobody shares a Facebook login to use it.
Claude can't see or change Meta account settings; status is **unknown** until the owner checks.

| # | Action | Where |
|---|---|---|
| O1 | Nobody shares a Facebook password. Each person uses their own profile. | — |
| O2 | Bangkok staff get their own Page access instead of logging into the owner's profile from Bangkok. | Meta Business Suite → Settings → People |
| O3 | Two-factor authentication on every admin profile. No VPN for Facebook. Log in from usual devices. | Facebook → Settings → Accounts Center → Password and security |
| O4 | Admin profile names match their ID. No new apps, portfolios or ad accounts from new or thin profiles. | — |
| O5 | App has a Privacy Policy URL, Terms URL and data deletion instructions URL; the policy names Supabase, Vercel and Groq. | developers.facebook.com → BPSO Clothing → App settings → Basic |
| O6 | Finish any Data Use Checkup or required action before its due date. | developers.facebook.com → Required actions, Alert Inbox |
| O7 | Verify the business portfolio. | Meta Business Suite → Settings → Security Center |
| O8 | Remove anyone unknown from the portfolio, the Page and the app's roles. Never share a portfolio, app, card or device with a restricted account. | Business Suite → People; App roles |
