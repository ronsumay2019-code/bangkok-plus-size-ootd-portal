# Review packet RP-001: Master Plan v3

**For: Grok (independent reviewer).** Paste or upload this whole file into Grok, then send Grok's full answer back to Claude.

## Your role
You are the **independent adversarial reviewer** for the Bangkok Plus Size OOTD live-selling portal. Another agent built or wrote what is below. Your job is to **find what is wrong, missing, risky or untrue**, not to praise it.

Rules you must judge against:
- The owner's **Live Selling Business** rules, included below. They are a HARD RULE.
- **Real data only:** no invented numbers.
- **No secrets** in code or docs.
- Nothing is sent to buyers without a person.

## What to send back (use exactly this format)
1. **Verdict:** APPROVE / CHANGES NEEDED / REJECT.
2. **Findings,** most serious first. For each one:
   - severity (Critical / High / Medium / Low);
   - where (section, or file and line);
   - what is wrong;
   - a concrete example of how it fails;
   - the fix you suggest.
3. **What you tried to break and could not.**
4. **Questions for the owner,** only if a business rule is unclear. Don't guess.

## What to attack in this review
- Does the plan **really follow the host first** (S1–S5)? Could any step end up following the buyers?
- **Messenger** orders and changes during the live (B7, B29), and **pre-orders** outside the live (B31): could an order be counted twice, missed, or put in the wrong invoice?
- **Evidence (B23):** could an order be marked "confirmed" without proof? Could the card show an older version instead of the latest?
- **Automatic host capture** (replay download plus transcription, T-031): what can fail? Is the 1-hour target (B24) realistic? What is the fallback?
- **Store match (S8):** does it actually catch extra or missing orders?
- **Security** (KI-004, KI-005) and the **0-data launch:** anything unsafe?
- **The Monday 26 Oct, 4 PM Manila deadline:** which tasks are on the critical path, and what is most likely to slip?

---
## A. The owner's rules (Live Selling Business; verbatim quotes removed to keep this short)


# Live Selling Business: HARD RULE (follow it like a bible)


## 1. The owner's words (recorded 2026-10-24, verbatim)


## 2. Rules for agents (taken from §1; each one cites the owner's words)

| # | Rule | From the owner's words |
|---|---|---|
| B1 | **There is no catalogue, rack, stock inventory or pre-defined item code.** Each live is unique. Its codes, prices, colours and sizes exist only because the host said them on that live. Codes belong to one live only. | "FORGET ABOUT CATALOGUE, RACKS, STOCK INVENTORY, PRE-DEFINED ITEM CODES … everyday is unique" |
| B2 | **Availability is unknown until store staff confirm it.** Nothing is "in stock" or "sold out" because of a number in the portal. | "we will only find out as checked by the store staff whether available or not" |
| B3 | **Item events come from the host, never from the chat.** An **Item Event** = item code, price, description, colours, sizes, and the time the host called the code. Details the host says before *or* after calling the code belong to that event. | "its the host who will tell those … THJS WAS AGENTS mistake, they find item code from the live chat" |
| B4 | **While capturing an Item Event, do nothing else.** Don't look for buyers or check anything yet. | "DO NOT CHECK, DO NOI START FINDING MINERS OR BUYERS, DO NOT INSPECT ANYTHING YET" |
| B5 | **No item window** *(changed 25 Oct, A2)*. Any item code the host has called can be ordered **at any point** in the live, even when the host is on the 9th item. "Between the 1st and 2nd event" is **when an agent starts processing** (the codes are known by then). It is **not** a limit on when buyers can order. | "an items window never really ends … all miners, all buyers are free and always welcome to like mine or order item codes before or called previously" |
| B6 | **Job 1: 1st capture.** A buyer comment containing any of **MINE + code**, **code only**, or **code + size or colour** is a match. It doesn't have to be an exact match. That buyer's first matching comment is their **1st capture** for that code. **"MINE" with no code, or "mine + size/colour" with no code, is not a capture yet.** It becomes one when it is **clarified in the chat**: the buyer retypes "mine + code", or answers the admin's question ("madam, is that mine 2XL red for which item code?") with the code. If it is never clarified, it goes on the admin's review list: never dropped, never guessed. **"+1", "one more", "two more", or a number after the code** means additional pieces. *(Updated 25 Oct, A3)* | "MINE + Item code … Item code only, Item code + Size or Colors" (24 Oct); "A mine without an item code will be clarified during live session … putting a number at the end … would take it as another order" (25 Oct) |
| B7 | **Job 2: review.** For every 1st capture, review the **entire** live chat **and Messenger**. Count how many times that buyer and order appear, and put each later mention into one of the types below. **A Messenger order placed during the live is a live order (live invoice)**, whatever the channel. **A Messenger adjustment of a chat order is the same order adjusted, never a second order.** That double entry is a known risk. A request is **denied only for out of stock**: "sorry, wala na po", "out of stock", "sold out". Otherwise it stands. *(Updated 25 Oct, A4)* | "Reviews the entire live chat … (Messenger check applies the same)" (24 Oct); "It should be considered as a live invoice because the order was placed during live session … if it's denied, only one reason why it's denied: it's out of stock" (25 Oct) |
| B8 | **Repeat.** Event → event → jobs, until the live ends. | "3rd Event - (REPEAT THE CYCLE + REAL JOBS) Until the live ends" |
| B9 | **A repeated "mine" with no request for another piece is 1 order.** Saying the quantity is the buyer's responsibility; the team's job is to clarify. | A7 |
| B10 | **More buyers than pieces: the first miner gets the item.** The earliest confirmed order wins. | A5: "A policy is like first miner will get the item first" |
| B11 | **Several items shown at once:** go by the item code the host calls for each. | A6 |
| B12 | **There is no buying list.** The true inventory is only what is physically held in the store. Some stores give counts per code, colour and size before the live, on paper; most don't. Once the team leaves the store, it is not inventory any more. | A8 |
| B13 | **Item codes are temporary.** They exist only to track who ordered what during one live. There is no link to past lives, even when the same garment was sold before. | A9 |
| B14 | **How the team works today.** An **off-camera admin** writes each confirmed order on paper: buyer's Facebook name, code, description, size, colour. The order is bagged and the bag labelled with the buyer's Facebook name and order. Codes and descriptions are not recorded otherwise ("called by ear"). **Right after the live:** reconciliation, with one person on the live chat and one on Messenger (sometimes one person does both); then sorting. **At home:** a second review, then invoicing. The portal replaces the paper, and changes none of these steps without the owner. | A1, A4, A5 |
| B15 | **Team:** the host; admin(s) in Bangkok; admins in the Philippines for local shipping (later, out of scope for now). | A9 |

### Job 2 outcomes

| Later mention | If granted | Orders at live end |
|---|---|---|
| Colour, size or item **replacement** | Remove the first order and replace it with what the buyer asked for. This becomes the **2nd capture**. | **1** |
| **Additional order** of the same item (identical, or a different colour or size) | Keep the first order and add the second. This is the **2nd capture plus one**. | **2** |
| **Swap** for another item | Remove the first order and replace it with the other item. This becomes the **2nd capture**. | **1** |
| **Appreciation, side chat or question only** ("Maganda yan", "malambot tela", "magkano") | **Change nothing.** | The 1st capture stands; the comment itself adds no order |
| Any request that was **denied** (the only reason is out of stock) | Change nothing; the item is not added. | The 1st capture stands |

**Hint, not a rule:** an event usually shows the host holding a garment or several garments.

## 3. The owner's answers (voice notes, 25 Oct 2026, verbatim transcript)










## 4. The owner's strategy, restated (voice note, 25 Oct 2026, verbatim transcript): **FOLLOW THE HOST**


**What this settles (agents read this before §2):**
- **S1, follow the host.** Processing starts with the host, never with the buyers. At 0 seconds the agent captures each item code the host calls, with the **price, size and colour**, which the host always says just before or after the code. The description and the number available are captured when the host says them. No buyer or "mine" is looked at yet.
- **S2, an event is a time segment.** Event N runs from the moment the host calls code N to the moment the host calls code N+1. The last event runs to the end of the live.
- **S3, inside each event, find the orders placed.** Find the buyers and miners, and what they ordered (code, size, colour, price from the host's call), in the live chat **and Messenger** during that segment. *(Clarified 25 Oct, S6: counting and following the later mentions is done after the live, across all events.)*
- **S4, the latest granted change is the final order.** The earlier capture is dropped from the final order but **kept in the item's story**: every capture and change, with its comment or message and time. Nothing is deleted.
- **S5, repeat** event by event until the live ends.
- **How this fits A2 (no item window).** An event is where the agent **looks**, not a limit on what buyers may order. An order placed in event 7 for a code called in event 3 is still an order for code 3.
- **Price (follow-up 2): settled.** The price comes from the host's words when the item is called.

### Clarification (voice note, 25 Oct 2026, verbatim transcript)


- **S6, events are a search filter only.** Events say where to **find where an order was placed**, so the count is accurate. An order placed in one event **can still be adjusted or added to in any later event, or in Messenger, until the live ends.**
- **S7, one reconciliation agent after the live, two passes.**
  - **Pass 1, confirmed orders.** An order that was placed once, with no requests, no other conversation and no Messenger side chat, is **confirmed** and set aside as final.
  - **Pass 2, followed threads.** An order that was acknowledged when placed and then **mentioned again**, once or many times, in any event or in Messenger: follow that thread to the end and decide whether it is a **change request** or **just a question**. A change request that was **acknowledged and approved** becomes the **final order**. The previous one is dropped from the total but kept in the item's story (S4). A question changes nothing.

### Price and the store match (voice note, 25 Oct 2026, verbatim transcript)


- **B16, every captured order has:** the item (taken immediately), the buyer's name, size, colour and **price**. Price is always recorded.
- **S8, the store match at the end of the live.** During the live, the **store owner** keeps their own count of the items ordered, and tracks what the team will pay; the team doesn't. At the end of the live, the team's **total number of items must equal the store owner's total**. If it doesn't, the difference is found before leaving the store.

### No people during the live (voice note, 25 Oct 2026, verbatim transcript)


- **B17, automatic during the live.** No person uses the portal during the live. Host capture, order capture and reconciliation are done automatically.
- **B18, people come in at the invoice.** A person uses the portal only once the orders are final and reconciled. They prepare the invoice, take a photo of it, and send it to the buyer in Messenger. Anything the agents could not decide is shown to that person, marked unclear, at that point. It is never guessed.

### Store match, replay and the live section (voice note, 25 Oct 2026, verbatim transcript)


- **S8, updated: the store match compares the total number of items only.** It is the only comparison the store owner's tally allows.
- **B19, host capture uses the method that worked before.**
  - After the live, download the replay through the Graph API (`<videoId>?fields=source,length`, Page token on the server).
  - Transcribe the host's speech.
  - Take the item codes, prices, sizes and colours from the transcript.

  The steps were proven in the old portal; see `bangkokplussizeootd/docs/REPLAY-ORDERS-PROCEDURE.md` step 3 (Whisper large-v3, language tl) and step 4 (lining up the comment clock with the replay clock). The old portal itself is not reused.
- **B20, Replay section.** A page where each past live can be reviewed: the video, the transcript, the host's item calls on a timeline, the orders found in each event, and each item's story.
- **B21, Live Session section.**
  - Clean and live-ready, with no data, before a live.
  - **When the live starts, it appears there automatically.**
  - **When the live ends, the video closes and the section clears automatically.**

  It clears from this section only (owner, 24 Oct). The live's data moves on to the Replay section and the order pipeline; nothing is deleted.

### Evidence over accuracy (voice note, 25 Oct 2026, verbatim transcript)


- **B22, transcription accuracy is not the bar; the story is.** Transcription (Groq Whisper) only has to be good enough to build each order's story and follow its thread to the final order.
- **B23, every confirmed or reconciled order carries evidence.** Every order, and every order sent for review, has a proof pack:
  - **the timestamp;**
  - **a screenshot from the actual live at that moment;**
  - **the comment or message that made it final;**
  - the host's words from the transcript, with the replay time;
  - the earlier steps of its story.

  An order without evidence is not confirmed.

### Store match timing and linking buyers (voice note, 25 Oct 2026, verbatim transcript)


- **B24, the store match happens within 1–2 hours after the live.** The team stays at the store for an hour or two after the live to sort, group orders, and tally against the store owner's invoice. **Target: the final orders and the item total are ready within 1 hour after the live ends.**
- **B25, the buyer's name is the name of the person who chatted** (owner, 25 Oct). It is the name Facebook shows on their comment or message. Invoices and bags use that name. Real names don't matter, so don't overthink it. A buyer's chat order and Messenger message are linked by that name, as the old portal did.

### The paper list (voice note, 25 Oct 2026, verbatim transcript)


- **B26, the paper list is the admin's personal scratch note.** It is written as fast as possible, as his own reference, not the team's. **It is not used as the source of truth for testing.**

### Invoices, Messenger and the trial weeks (owner, 25 Oct 2026; key words verbatim)






- **B27, what a buyer receives:**
  - **the invoice as a picture in the shop's template**, never plain text;
  - **a photo of their order inside its plastic bag**, taken in the invoice generator;
  - the shop's own message.

  Sent inside Messenger. **Evidence is internal only and never sent.**
- **B28, one invoice line per item** (code + size + colour), with a quantity. Invoices stay short.
- **B29, Messenger during the live.** The team replies in Messenger. The host can't see Messenger. **A Page reply that acknowledges a Messenger change or order counts as its approval**, the same as the host's "noted" on the live.
- **B30, trial weeks.**
  - For the first week or weeks, the team keeps its traditional way and the portal runs alongside.
  - After each live, a **match report** compares the portal's final orders with the invoices actually sent in Messenger and with the store owner's total.
  - The owner switches over once the reports prove the portal accurate.

### Pre-orders and the portal clean-up (voice note, 25 Oct 2026; key words verbatim)



- **B31, two kinds of invoice.**
  - An order placed **during** the live, in the chat or Messenger, gets a **Live invoice**.
  - An order placed **before or after** the live, usually in Messenger after re-watching the replay, gets a **Pre-order invoice**.
  - A buyer who has both: **the amounts add up** to what the buyer owes in total. The shop's template already titles them "LIVE ORDER INVOICE" and "PRE-ORDER INVOICE" (`invoice-artwork.ts`).
- **B32, the owner overrides without giving a reason:** a tick box next to the line in the invoice generator.

## 5. Still open

1. ~~When is the host captured?~~ **Answered by B17: automatically.** No admin entry during the live. Host capture comes from the live's video and audio, by an agent. Whether this works on a real replay (fetching the video, then accuracy on Taglish speech) is being tested (T-031). The test is paid, so it needs the owner's approval of its exact cost first.
2. ~~The store match (S8)~~ **Answered: total count only.**
3. ~~What the screenshot shows.~~ **Answered 25 Oct:** the side-by-side card is approved ("I really like it"); see [[Screens]].
   *Original question:* A frame taken from the replay at the comment's time shows what the host was holding. It does **not** show the comments, because Facebook doesn't burn comments into the video. The comment itself comes from Facebook's data: name, text, time and a link that opens it on Facebook. Our plan is to show both side by side as the evidence card. A real screenshot of the comment as it looked on Facebook would need a browser logged in to Facebook, which is fragile. Is the evidence card enough?


---

## B. The plan

# Master Plan: production-ready by Mon 26 Oct 2026, 4:00 PM Manila

Author: Claude (lead). Status: **G1 draft, waiting on Grok's independent review (G3) and the owner's answers to the Live Selling Business questions.**
Built on: [[Live-Selling-Business]] (HARD RULE), [[Current-State]], [[Known-Issues]], [[Lessons]].

## 1. What "done" means (v3, 25 Oct: follow the host)

Production goes live **empty (0 data)**. After a real live, the portal produces the final orders the way the owner's strategy says ([[Live-Selling-Business]] §4):

1. **Host events first:** each item code with its price, size and colour, and its time.
2. **Then, inside each event:** the orders from the live chat and Messenger.
3. **Then the review:** every mention counted and typed, and the latest granted change is final.
4. **The item story keeps everything.** Nothing is deleted.
5. A person reviews.
6. The owner approves one invoice per buyer for the live.
7. The invoice is sent or copied in Messenger and marked sent, which starts the buyer's 24h.
8. The payment proof is recorded.
9. Paid orders go to Shipping; unpaid orders go to Payments.

The team keeps its paper list during the first lives, so both results can be compared.

GO requires:
- the acceptance suite passes ≥95% overall and 100% of its critical scenarios;
- the golden test passes;
- the owner says GO.

## 2. The design of the core (W2), v3

| Step | What it does | Rule |
|---|---|---|
| **1. Host Event capture** | ItemEvent = `{live, seq, code, price, sizes[], colours[], description?, available?, calledAt, source: replay \| admin, evidence}`. **This is the first and only source of codes and prices.** **Automatic, from the live's video and audio (B17).** No admin entry. Feasibility is being tested in T-031. | S1, B3, L-009 |
| **2. Raw capture** | Every live comment, and every Messenger message during the live, is saved raw (id, time, name, text). Nothing is filtered when it is saved. | B7 |
| **3. Segments** | Event N = [calledAt N, calledAt N+1). The last segment runs to the end of the live. **A search filter for where an order was placed, not a limit:** later changes in any event or in Messenger still count. | S2, S6 |
| **4. Job 1, per segment** | Find the orders placed in the segment's chat and Messenger: MINE+code, code only, code+size/colour, against **codes from host events only**. MINE with no code is matched by its clarifying reply (B6). "+1", "one more" or a number means extra pieces. A repeated "mine" stays 1 order. | S3, B6, B9 |
| **5. Job 2: one reconciliation agent after the live** | **Pass 1:** an order placed once, with no requests, no other conversation and no Messenger side chat, is **confirmed**. **Pass 2:** an order mentioned again, in any later event or in Messenger: follow the thread to the end and type it as a change request (item/size/colour), extra piece, swap, question, or denied (out of stock only). An acknowledged and approved change is the final order; the previous one is dropped and kept in the story. Anything the agent can't decide is shown at invoice time, marked unclear, and never guessed (B18). | S4, S6, S7, B7, B18 |
| **6. Item story and evidence** | For each code: every capture, change and denial, with its comment or message link and time. The final order points back into its story. **Every confirmed order has an evidence card (B23):** timestamp, replay frame at that moment, the final comment or message (name, text, time, Facebook link), the host's transcript line, and the earlier steps of its story. No evidence means not confirmed. | S4, B23 |
| **8. Store match** | At the end of the live: the team's total number of items is shown next to the store owner's total. If they differ, the portal lists the orders per code so the difference can be found before leaving the store. | S8 |
| **7. First miner and bag list** | When pieces run short, the earliest confirmed order keeps the piece. The bag list per buyer matches the bag labels. | B10, B14 |
| **Golden test** | A past live's replay events, comments and Messenger messages go through steps 1–7, plus the owner's decisions on anything unclear. The result must equal **the invoices actually sent to buyers** for that live (inside Messenger, confirmed by the owner 25 Oct), **and its total items must equal the store owner's total** for that live (owner-held). The paper list is not the truth (B26). It is computed, never typed in (L-008). | — |
| **Retired** | The rack, inventory board and 90% buying-list rule (B12). The "Live Order Sheet" built from orders (L-009). | B12 |

## 3. Tickets on the critical path (each 15 min or less; split further at G1)

| Ticket | Work | Builder | Review | Needs |
|---|---|---|---|---|
| T-001 | Owner answers Business Q1–Q9 | Owner | — | **Done 25 Oct.** Three short follow-ups are in [[Live-Selling-Business]] §4 |
| T-002 | **Golden fixture:** the invoices actually sent for one past live (NEW SHOP 22 Oct: the portal's Messenger copy holds 16 invoice-like Page messages to 15 buyers on 23 Oct, possibly incomplete), plus the store owner's total for that live, plus its video id, comments and Messenger messages | Claude gathers; owner confirms the invoice list is complete | Claude | Owner confirmation |
| T-003 | **W7 infrastructure:** CI on PRs (`typecheck`, `test`, `build`, `kos-check`), branch protection on `main`, the Timeline Action | Codex | Grok, Claude | Owner allows branch protection on GitHub |
| T-004 | **W7:** a Supabase branch (or schema copy) holding the backup data, for the preview | Codex | Claude | Owner approves the branch's cost, if any |
| T-005 | **W5 security:** RLS lockdown (remove `temp_dev_all`; service role only); move the Page token out of `portal_kv` into env only | Codex | Grok, Claude | **Owner approves the migration** |
| T-010 | **W1:** save the raw chat for every comment (no filtering at save time); reset seen-IDs together with the data | Antigravity | Grok, Claude | — |
| T-011 | **W2:** Host Event capture, automatic: data model, plus extracting code, price, sizes and colours from the transcript, with the evidence time for each | Antigravity | Grok, Claude | T-031 result |
| T-031 | **Spike (TOP PRIORITY, critical path): the proven replay method, made automatic.** Replay download through `fields=source,length` (token on the server only), audio cut with ffmpeg (16 kHz mono), Whisper large-v3 (tl), clock alignment (REPLAY-ORDERS-PROCEDURE steps 3–4). It runs as a background job outside Vercel's time limit (proposal: a GitHub Action). Run on the LINEN SHOP replay. Report: download OK, whether the transcript is good enough to build each order's story (B22; accuracy is reported but is not the bar), a sample evidence card (replay frame plus comment), the replay's ready time after the live, processing time, and the exact cost. No spending without owner approval. | Codex (Claude evaluates) | Grok, Claude | A transcription API key in settings (owner); cost approval if not free |
| T-032 | **Spike: automatic live start and end.** Detect a new live (the feed webhook's first comment on a new video, or the `live_videos` webhook) and its end (`live_videos` webhook or video status), without Meta App Review. | Codex | Grok, Claude | Owner checks the webhook subscriptions in Meta |
| T-033 | **Replay section (B20):** video, transcript, host-call timeline (tap to jump), orders per event, item stories | Antigravity | Grok, Claude | T-031 |
| T-035 | **Orders review page and buyer view** ([[Screens]] §3–5): grouped by buyer, counts, store match box, filters, order lines plus evidence | Antigravity | Grok, Claude | T-013 |
| T-036 | **Invoice generator, all in one screen** ([[Screens]] §6): preview with a proof panel, tap-to-edit (no reason field; original kept in the story), take photo (existing camera feature), message field, send the invoice picture plus the bag photo in Messenger | Antigravity | Grok, Claude | T-035, T-037 |
| T-037 | **Port the shop's invoice template renderer** (`bangkokplussizeootd/lib/invoice-artwork.ts`): picture pages, "Page x of y", QRs from settings, one line per item with quantity, item text from the host's call | Codex | Grok, Claude | — |
| T-038 | **Match report for the trial weeks (B30):** after each live, the portal's final orders against the invoices actually sent in Messenger and the store owner's total, listing matched / extra / missed | Codex | Claude | T-013 |
| T-039 | **DONE on the branch 25 Oct (not deployed; Grok review pending).** **Tabs and clean-up** ([[Screens]], decided 25 Oct): 7 tabs (Live, Replay, Orders, Pre-orders, Invoices, Payments & Shipping, Messages). Remove Analytics, Pola AI, Strategic analysis and the rack board. Owner override becomes a tick box with no reason field. | Antigravity | Grok, Claude | — |
| T-034 | **Live Session section (B21):** clean when idle; appears automatically on live start; closes and clears automatically on live end (data moves on, nothing deleted) | Antigravity | Grok, Claude | T-032 |
| T-012 | **W2:** Segments and Job 1 per segment as pure functions (codes from host events only; extra pieces; repeated mine), with unit tests built from real comment text | Codex | Grok, Claude | — |
| T-013 | **W2:** Job 2 per order (count mentions, type them, latest granted change is final), item story, first miner, bag list | Antigravity | Grok, Claude | — |
| T-014 | **W2:** golden test harness: fixture in, final orders out, diff against the owner's list | Codex | Claude | T-002 |
| T-015 | **W3:** invoices built from final orders; one invoice per live per buyer; owner approval; mark-sent starts the 24h; fix the wording in KI-011 | Antigravity | Grok, Claude | T-013 |
| T-016 | **W4:** payment proof, then Payments or Shipping (exists; re-test it on the new orders) | Codex | Claude | T-015 |
| T-020 | **Acceptance suite:** owner-flow scenarios with the critical ones marked, frozen by Sun 12 PM | Claude, with Grok adding attack cases | Owner reads it | — |
| T-021 | **W1:** `META_APP_SECRET` in Vercel; webhook signature check turned on | Codex | Grok | **Owner enters the secret in Vercel** |
| T-030 | Launch: backup, wipe, prove 0 rows, smoke test, release note, final Story chapters | Claude | Owner | GO |

**Cut first if a milestone slips** (not critical):
- Pola AI copilot;
- buying-behaviour dashboard;
- Messenger photo polish;
- Shipping tracking detail;
- replay transcription.

**Never cut:** any gate, W2, W5, golden tests, the 0-data launch.

## 4. Schedule (re-planned Sun 25 Oct, 04:44 Manila, after the first milestone was missed)

The owner's PC clock showed 3:34 PM on 24 Oct when it was 04:34 Sunday in Manila, so the owner's local time appears to be **13 hours behind Manila** (UTC-5). Both columns are shown. The deadline is fixed in Manila time.

| Manila | Owner's clock (UTC-5) | Done |
|---|---|---|
| ~~Sat 11 PM~~ | ~~Sat 10 AM~~ | **Missed.** G0 and the plan draft were done. The Grok review and the Q1–Q9 answers were not. |
| Sun 12 PM | Sat 11 PM | Q1–Q9 answered; Grok's plan review saved; RLS migration approved; branch protection allowed; T-003, T-004, T-020 |
| Sun 6 PM | Sun 5 AM | T-002 golden fixture (one past live: Item Events and the confirmed order list) |
| Sun 10 PM | Sun 9 AM | T-005, T-010 to T-015 through G4 |
| Mon 10 AM | Sun 9 PM | Code freeze; T-016; full acceptance run on the preview (G5) |
| Mon 2 PM | Mon 1 AM | Final run; go/no-go report |
| **Mon 4 PM** | **Mon 3 AM** | **Owner GO, then T-030** |

**Risk, stated plainly.** W2 can't start until Q1–Q9 are answered, and Antigravity, Codex and Grok can only work when the owner hands them the repo. If Q1–Q9 aren't answered by Sun 12 PM Manila, W2 isn't likely to pass G5 by Mon 10 AM, and the honest outcome would be NO-GO or a cut scope, reported at once.

## 5. What only the owner can do

- Answer Business Q1–Q9.
- Give the golden-fixture time on Sunday morning (T-002).
- Approve the RLS migration (T-005).
- Enter `META_APP_SECRET` in Vercel.
- Allow branch protection.
- Submit Meta App Review (needed for names in Graph reads; not on Monday's path, because the webhook gives names).
- Approve any paid service.
- Give GO.

## 6. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Business answers arrive late | Medium | Blocks W2 | The questions are small and specific; Claude collects the answers Saturday night |
| No golden fixture by Sunday noon | Medium | No proof, so NO-GO | Use the shorter live; Claude prepares the sheet so staff only fill it in |
| **Automatic host capture doesn't work** (the video can't be fetched, or transcription is inaccurate on Taglish) | **Unknown until T-031** | **The core can't follow the host, so NO-GO for W2** | Run T-031 first. If it fails, report at once with the options; the owner decides (B17 says no people during the live). |
| The replay plus transcription takes longer than the **1-hour target** after the live (B24; the team has 1–2 hours at the store). The old doc notes the free plan's hourly audio limit. | Unknown | The store match waits | T-031 measures the ready and processing times against the 1-hour target; if over, report the options (for example a paid tier, with the exact cost) |
| Two buyers with the same Facebook name are merged | Low | Wrong bag or invoice | Flag same-name cases, never merge them (B25) |
| Comment delay puts a "mine" in the wrong window | High | Wrong item | Business Q3 grace period; Job 2 review |
| Webhook names missing for some buyers | Medium | Can't invoice | "Name needed" queue; Messenger match |
| Vercel access for agents (403 today) | Known | Can't audit deploys | Owner checks the Vercel team permissions for the connected account |

## Handoff Packet

1. **What I did:**
   - recorded the Live Selling Business;
   - ran the truth audit with real queries;
   - seeded the KOS (Current-State, Known-Issues, Lessons, Story);
   - wrote this plan.
   No portal code was changed.
2. **Why this is the real solution:**
   - The portal fails because it reads item meaning from the chat. The Live Selling Business says meaning comes from the host's Item Events. Every past attempt had either no events or fixed events, so no amount of comment parsing could ever be right.
   - The plan makes events the first-class input.
   - It keeps people deciding the Job 2 changes, because grant or deny is said on the live and isn't in the data.
   - It proves the result with a computed golden test instead of a typed number.
3. **Evidence:** the SQL counts and policies in [[Current-State]], and the commits named in [[Story]].
4. **Tests:** none yet. This is a plan.
5. **Risks:** §6. The biggest is the time needed from the owner on Sunday.
6. **Not done:**
   - no code;
   - no migration;
   - Vercel deployment audit (403).
7. **Next:** Grok, independent review of this plan (G3). The owner: Business Q1–Q9.

## Evaluator Verdict (Claude)

**Verdict: CHANGES, pending independent review.**

I wrote this plan, so my verdict is a self-check, not the independent review the loop requires. Grok reviews it next.

Self-check reasoning:
- The plan follows every Business rule (B1–B8) and puts the owner's correction (L-007) at its centre.
- It doesn't depend on Meta App Review or a paid transcription service for Monday.

Conditions before G1 passes:
- the owner's answers to Q1–Q9;
- a fixture for the golden test.


---

## C. Approved screens

# Screens (owner-approved direction, 25 Oct 2026)

The pictures below are **samples with made-up data**, showing layout only.

## 1. Live Session
- Clean before a live.
- Appears by itself when the live starts; closes and clears by itself when it ends (B21).
- No one uses the portal during the live (B17).

## 2. Replay
- Each past live: the video, the transcript, the host's item calls on a timeline (tap one to jump), the orders found in each event, and each item's story (B20).

## 3. Orders review: all buyers of one live
- **Grouped by buyer,** 20 per page, with search.
- **Counts at the top:** pieces, buyers, confirmed, changed, need a look.
- **Store match box:** our total next to the store owner's total (S8).
- **Filters:** Need a look / Changed / Ready to invoice / Invoiced.
- **Buyer actions:** "Generate invoice" per buyer; "Resolve first" when something is unclear. Sold-out pieces show "not billed".

## 4. One buyer: order lines plus evidence
- **Left:** the order lines, exactly what goes on the invoice, tagged OK / Changed / Swap / +1 / Sold out.
- **Right:** everything the buyer said in the live chat and Messenger, in time order, each with its replay frame and the host's or Page's reply.
- Tapping a line highlights its evidence.

## 5. Evidence card (one order)
- **Contents:** replay frame at the final comment's time; the final comment (chat name, text, time, link to Facebook); the host's words; the host's call for the item; the story; the final order only.
- **Internal only: never sent to buyers.**

## 6. Invoice generator: all in one screen (owner: "That's exactly what we need")
1. **Review & proof:** the invoice preview, with "proof" on every line opening the evidence card beside it. Lines can be edited by tapping them. **No reason field.** The original quietly stays in the order's story.
2. **Confirm.**
3. **Take a photo:** the phone camera photographs the order inside its plastic bag. This is the existing camera feature in `src/components/AutoReconciliationSummary.tsx` (`capture="environment"`). Retake is possible.
4. **Message:** a text field at the top for the shop's own message.
5. **Send:** the **invoice picture in the shop's template** (B27), plus the bag photo, plus the message, go to the buyer in Messenger. The owner approves before sending (shop rule).

## Invoice template
- **Renderer:** the shop's existing template, drawn by `bangkokplussizeootd/lib/invoice-artwork.ts` (old portal). It is ported into this portal, not redrawn.
- **Contents:** pink header ("Bangkok Plus Size OOTD · Since 2021 | Bangkok to Philippines"); "LIVE ORDER INVOICE"; the invoice number and status; Bill to (the chat name); live, invoice date, payment due and 24-hour window; ITEM / SIZE, QTY, UNIT PRICE, AMOUNT; subtotal, shipping, total and balance; shop-approved payment QRs (GCash / Maya / Bank from settings); payment notes; QR warning; "Page x of y".
- **Item line:** comes from the host's call (code, description, colour, size), never the buyer's comment text. The old sample showed "Teal po mine / Not specified" (L-007).
- **One line per item** (code + size + colour) with a quantity, e.g. "T7 Linen set · Black / 3XL × 100" (B28).

## Tab names and clean-up (decided by the owner, 25 Oct)

**Seven simple tabs:**

| Tab | Was | Notes |
|---|---|---|
| **Live** | Live Session Command | Appears and clears by itself (B21) |
| **Replay** | Replay Review Studio | Review each past live (B20) |
| **Orders** | Order Review & Verification, plus live-time Messenger orders | Buyers, evidence, store match ([[Screens]] §3–5) |
| **Pre-orders** | Pre-Orders Lane | **Kept**: a separate revenue stream (B31) |
| **Invoices** | Reconciliation & Invoices | All-in-one invoice generator; live invoices and pre-order invoices |
| **Payments & Shipping** | same | Unchanged |
| **Messages** | the Messenger inbox in Page Messenger Orders | **Kept as is** |

**Removed:**
- Sales & Demand Analytics;
- Pola AI Co-Pilot;
- the Strategic analysis pop-up;
- the old inventory / rack board.

**Owner override: kept, with no reason asked.** In the invoice generator it is a **tick box next to a line**; ticking it lets the owner override that line.

**Kept as they are:**
- staff sign-in links (5 seats);
- the owner's Facebook token form;
- the owner's Start fresh;
- the READY / ON AIR status.


---

## D. Known issues

# Known issues

Severity: **C** = critical (blocks GO), **H** = high, **M** = medium.

| ID | Sev | Issue | Evidence | Fix (ticket) |
|---|---|---|---|---|
| KI-001 | C | **No Item Event capture.** Codes, prices, colours and sizes are taken from the chat instead of from the host. This breaks Business B3. | `server/orderIntent.ts`; controller removed in `6857377` | W2 |
| KI-002 | C | **No order windows and no Job 1 / Job 2.** Each comment is judged alone (Business B5–B7). | Code | W2 |
| KI-003 | C | **The reconciliation engine assumes a rack and stock inventory.** This conflicts with Business B1 and B2. | `src/services/reconciliationEngine.ts` | W2: retire it from the critical path (A8: no buying list) |
| KI-004 | C | **Anyone holding the anon key has full access** to `portal_staff`, `portal_sessions`, `portal_kv` and `portal_records` (the `temp_dev_all` policy). A forged session or a token read is possible. | pg_policies | W5 |
| KI-005 | C | **The Facebook Page token is stored in `portal_kv.metaCredentials`.** It should live in env vars only, and is exposed by KI-004. | portal_kv keys | W5 |
| KI-006 | H | **LINEN SHOP orders are not in the portal** (1 order). `seenCommentIds` is stale. | Row counts | W1; tests only (ships with 0 data) |
| KI-007 | H | **The "152 = 152" of 22 Oct was hand-set,** not computed. | `271b9f2` | W2 golden test |
| KI-008 | H | **`META_APP_SECRET` is not set,** so webhooks are not signature-checked. | Session 24 Oct | W1, needs owner |
| KI-009 | H | **Names in Graph reads are hidden** until Meta App Review. | Observed | Owner (Meta) |
| KI-010 | M | **The main repo docs conflict with the Live Selling Business.** `bangkokplussizeootd/CLAUDE.md` and LIVE-SELLING-ARCHITECTURE describe a rack, a run sheet, an Inventory board and the 90% purchase rule. The Live Selling Business wins. Confirmed by the owner 25 Oct (A8). | Docs | Mark the main repo docs as outdated for live selling |
| KI-011 | M | **FIXED on the branch 25 Oct.** **Wrong 24h wording on screen.** The "Ready for the next live" card says "within 24 hours of the live"; the rule is 24h from when the invoice is marked sent. | `src/components/ReadyForNextLive.tsx:113` | W3 |
| KI-012 | M | **Vercel deployment listing was refused (403)** for this session, so the production deployment can't be audited. | Tool error | W7 |
| KI-013 | M | **23 TypeScript errors exist in the code** (`npm run lint`: seed data, reconciliation engine, vite config). They were there before 25 Oct; the build and tests still pass. | `npm run lint` | W7: fix before CI makes lint required |


---

## E. Current state (truth audit)

# Current State: truth audit

As of Sun 25 Oct 2026, about 04:20 Manila (24 Oct, about 20:20 UTC). Corrected: an earlier draft said "22:xx". Every line is either **Verified**, with its evidence, or **Not verified**. Claims don't count.

## Production database (Supabase `bpso-live-portal`, ref `muqgabsvghhytwawipex`)

Evidence: SQL row counts run by Claude on 24 Oct.

| What | Count | Status |
|---|---|---|
| Lives | 2. "LINEN SHOP😍" (FB video `3310662652470857`, 05:35Z to 13:34Z) and an empty "Live · 2026-10-24" (13:43Z, 7 seconds long) | Verified |
| Orders | **1** (LINEN SHOP orders were not captured) | Verified |
| Messenger threads / messages | 182 / 1,365 | Verified |
| Backup `portal_backup.records_20261024_before_reset` | orders 1,352 · lives 2 (NEW SHOP 22 Oct, video `1126219396590785`; NEW SHOP 24 Oct) · inventory 11 · threads 134 · messages 830 | Verified |
| `portal_kv.metaCredentials` | Holds the keys `token` and `pageId`. **The Facebook Page token is stored in the database.** The value was not read. | Verified (keys only) |
| Row-level security | `temp_dev_all` policy, role `anon`, ALL commands, on `portal_kv`, `portal_records`, `portal_sessions` and `portal_staff` | Verified |
| The server uses the service-role key; the anon key is not in the client code | `grep` of `server/`, `src/` and `dist/` | Verified |

## Portal behaviour

| What | Status | Evidence |
|---|---|---|
| Messenger reply sent from inside the portal | Verified 24 Oct | Facebook returned message IDs; the recipient confirmed |
| Staff sign-in and seats (owner, co-owner, 3 admins) | Verified 24 Oct | Owner signed in on production |
| Saving to the database after the null-kv fix (PR #6) | Verified in tests (38 pass) | Not re-verified on production since |
| **Item Event capture from the host** (Business B3) | **Does not exist.** The controller from `283fd52` was removed in `6857377`. It used fixed segments (`HOST_BROADCAST_SEGMENTS`), not live input. | git history |
| Order windows and Job 1 / Job 2 (Business B5–B7) | **Do not exist.** `server/orderIntent.ts` reads each comment alone, with no window and no event. | Code |
| Reconciliation engine | **Built on a rack** (`InventoryItem` rows, 25 uses in `src/services/reconciliationEngine.ts`). Conflicts with Business B1. | Code |
| "152 = 152" on 22 Oct | **Not proven to be computed.** `271b9f2` sets `totalMined: 152` and edits `purchased` by hand, with orders loaded from `src/data/liveOrdersSnapshot.json`. | git show |
| Commenter names from Facebook | Hidden in Graph reads until Meta App Review; the webhook gives names | Observed 24 Oct |
| `META_APP_SECRET` (webhook signature check) | Not set when last checked on 24 Oct | Not re-checked |
| Latest production deployment | **Not checked.** Vercel refused the listing (403 forbidden). | Tool error 24 Oct |
