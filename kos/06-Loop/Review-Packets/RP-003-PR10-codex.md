# Review packet RP-003: PR #10 (Codex), Job 1 + invoice template + kos-check

**For: Grok (independent reviewer).** Upload this whole file into Grok, then paste Grok's full answer back to Claude.

## Your role
You are the **independent adversarial reviewer**. Codex built this. **Find what is wrong, missing or risky.** Don't praise. Judge against the owner's rules below (HARD RULE).

## What to send back (exactly this format)
1. **Verdict:** APPROVE / CHANGES NEEDED / REJECT.
2. **Findings,** most serious first. For each one:
   - severity (Critical / High / Medium / Low);
   - file and line;
   - what is wrong;
   - **a concrete example input and the wrong output**;
   - the fix.
3. What you tried to break and could not.
4. Questions for the owner, only if a business rule is unclear.

## What to attack
- **`server/liveEngine/job1.ts`.** Feed it realistic Taglish live comments in your head:
  - Can a **real order be lost silently** (not captured and not put in "unclear")?
  - Can a **non-order become an order**?
  - Can an order get the **wrong size, colour, quantity or code**?
  - Check:
    - repeated "mine";
    - "+1" and "two more";
    - a number after the code;
    - unclear "mine" and how it gets clarified;
    - codes like T1 vs T12, and numeric-only codes;
    - Messenger messages;
    - messages that arrive before the first host call.
- **`server/liveEngine/segments.ts`:** edge cases in time ordering, duplicate codes, re-called items.
- **`src/utils/invoiceArtwork.ts`:**
  - money rounding;
  - grouping into one line per item with quantity;
  - "Page x of y";
  - long invoices;
  - live vs pre-order title;
  - anything hard-coded that should come from settings (QRs, names, numbers).
- **`.github/workflows/kos-check.yml`:** can it be bypassed, or does it fail wrongly?
- **Tests:** what important case is missing?

## The owner's rules that apply
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



Additional rules (summaries):
- **S1, follow the host.** Processing starts with the host, never with the buyers. At 0 seconds the agent captures each item code the host calls, with the **price, size and colour**, which the host always says just before or after the code. The description and the number available are captured when the host says them. No buyer or "mine" is looked at yet.
- **S2, an event is a time segment.** Event N runs from the moment the host calls code N to the moment the host calls code N+1. The last event runs to the end of the live.
- **S3, inside each event, find the orders placed.** Find the buyers and miners, and what they ordered (code, size, colour, price from the host's call), in the live chat **and Messenger** during that segment. *(Clarified 25 Oct, S6: counting and following the later mentions is done after the live, across all events.)*
- **S4, the latest granted change is the final order.** The earlier capture is dropped from the final order but **kept in the item's story**: every capture and change, with its comment or message and time. Nothing is deleted.
- **S5, repeat** event by event until the live ends.
- **S6, events are a search filter only.** Events say where to **find where an order was placed**, so the count is accurate. An order placed in one event **can still be adjusted or added to in any later event, or in Messenger, until the live ends.**
- **S7, one reconciliation agent after the live, two passes.**
- **B16, every captured order has:** the item (taken immediately), the buyer's name, size, colour and **price**. Price is always recorded.
- **S8, the store match at the end of the live.** During the live, the **store owner** keeps their own count of the items ordered, and tracks what the team will pay; the team doesn't. At the end of the live, the team's **total number of items must equal the store owner's total**. If it doesn't, the difference is found before leaving the store.
- **B17, automatic during the live.** No person uses the portal during the live. Host capture, order capture and reconciliation are done automatically.
- **B18, people come in at the invoice.** A person uses the portal only once the orders are final and reconciled. They prepare the invoice, take a photo of it, and send it to the buyer in Messenger. Anything the agents could not decide is shown to that person, marked unclear, at that point. It is never guessed.
- **S8, updated: the store match compares the total number of items only.** It is the only comparison the store owner's tally allows.
- **B19, host capture uses the method that worked before.**
- **B20, Replay section.** A page where each past live can be reviewed: the video, the transcript, the host's item calls on a timeline, the orders found in each event, and each item's story.
- **B21, Live Session section.**
- **B22, transcription accuracy is not the bar; the story is.** Transcription (Groq Whisper) only has to be good enough to build each order's story and follow its thread to the final order.
- **B23, every confirmed or reconciled order carries evidence.** Every order, and every order sent for review, has a proof pack:
- **B24, the store match happens within 1–2 hours after the live.** The team stays at the store for an hour or two after the live to sort, group orders, and tally against the store owner's invoice. **Target: the final orders and the item total are ready within 1 hour after the live ends.**
- **B25, the buyer's name is the name of the person who chatted** (owner, 25 Oct). It is the name Facebook shows on their comment or message. Invoices and bags use that name. Real names don't matter, so don't overthink it. A buyer's chat order and Messenger message are linked by that name, as the old portal did.
- **B26, the paper list is the admin's personal scratch note.** It is written as fast as possible, as his own reference, not the team's. **It is not used as the source of truth for testing.**
- **B27, what a buyer receives:**
- **B28, one invoice line per item** (code + size + colour), with a quantity. Invoices stay short.
- **B29, Messenger during the live.** The team replies in Messenger. The host can't see Messenger. **A Page reply that acknowledges a Messenger change or order counts as its approval**, the same as the host's "noted" on the live.
- **B30, trial weeks.**
- **B31, two kinds of invoice.**
- **B32, the owner overrides without giving a reason:** a tick box next to the line in the invoice generator.

## The builder's own checks (claimed by Codex)
- `npm test`: 53 pass.
- `npm run build`: OK.
- `npm run lint`: the same 23 old errors as before.

## The full code change (PR #10 vs `claude/clever-noether-tta7o2`; the sample image is omitted)

```diff
diff --git a/.github/workflows/kos-check.yml b/.github/workflows/kos-check.yml
new file mode 100644
index 0000000..7c12832
--- /dev/null
+++ b/.github/workflows/kos-check.yml
@@ -0,0 +1,41 @@
+name: KOS check
+
+on:
+  pull_request:
+
+permissions:
+  contents: read
+
+jobs:
+  kos-check:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+        with:
+          ref: ${{ github.event.pull_request.head.sha }}
+          fetch-depth: 0
+          persist-credentials: false
+      - name: Require a knowledge base update
+        shell: bash
+        env:
+          PR_BASE_SHA: ${{ github.event.pull_request.base.sha }}
+        run: |
+          set -euo pipefail
+          changed_files=$(mktemp)
+          trap 'rm -f "$changed_files"' EXIT
+          git diff --name-only --no-renames -z "$PR_BASE_SHA...HEAD" > "$changed_files"
+
+          has_kos=false
+          has_other=false
+          while IFS= read -r -d '' path; do
+            case "$path" in
+              kos/*) has_kos=true ;;
+              *) has_other=true ;;
+            esac
+          done < "$changed_files"
+
+          if [[ "$has_other" == true && "$has_kos" == false ]]; then
+            echo "This PR changes code but doesn't update the knowledge base in kos/. Update the ticket's Handoff Packet and kos/04-State/Current-State.md."
+            exit 1
+          fi
+          echo "Knowledge base check passed."
diff --git a/docs/samples/README.md b/docs/samples/README.md
new file mode 100644
index 0000000..4e1c8a8
--- /dev/null
+++ b/docs/samples/README.md
@@ -0,0 +1,8 @@
+# Invoice SAMPLE
+
+`invoice-SAMPLE.png` is made-up data, rendered using `invoiceArtwork` in local
+headless Chromium. It contains no real buyer, payment QR, account or phone number.
+It is the T-037/issue #8 PR visual evidence, not an issued invoice.
+
+The sample groups three T7 3XL Black pieces at ₱650.00 into one row, quantity 3,
+amount ₱1,950.00, plus SAMPLE shipping ₱80.00; total ₱2,030.00.
diff --git a/kos/04-State/Current-State.md b/kos/04-State/Current-State.md
index 4ac3a4c..58ca736 100644
--- a/kos/04-State/Current-State.md
+++ b/kos/04-State/Current-State.md
@@ -30,3 +30,11 @@ Evidence: SQL row counts run by Claude on 24 Oct.
 | Commenter names from Facebook | Hidden in Graph reads until Meta App Review; the webhook gives names | Observed 24 Oct |
 | `META_APP_SECRET` (webhook signature check) | Not set when last checked on 24 Oct | Not re-checked |
 | Latest production deployment | **Not checked.** Vercel refused the listing (403 forbidden). | Tool error 24 Oct |
+
+## Issues #7, #8, #9 · builder evidence (26 Oct UTC)
+
+- T-012: pure host-event segments and Job 1 implemented; tests in `tests/liveEngine.test.ts`. No routes/UI wired. Messages must be scoped to the live by the caller (job1 has no live-end parameter).
+- T-037: shop invoice canvas renderer ported with pure grouping/pagination tests and SAMPLE artwork. No generator UI or sending changes.
+- T-003b: `kos-check` workflow added and validated with disposable git histories; hosted Actions execution not yet verified. Existing CI unchanged.
+- Local `npm test`: 53 Node tests passed, 0 failed, plus the reconciliation integration suite passed. `npm run build`: passed. Lint baseline: 23 existing diagnostics; no new diagnostics. These are local implementation checks, not production verification.
+- Status: in review; Grok review and Claude evaluator verdict pending. No deployment or production data changes.
diff --git a/kos/04-State/Open-Loop.md b/kos/04-State/Open-Loop.md
index 79d6298..13308a2 100644
--- a/kos/04-State/Open-Loop.md
+++ b/kos/04-State/Open-Loop.md
@@ -48,3 +48,5 @@ Platform sweep, 24 Oct (Claude):
 | OL-28 | Simple tab names, and which old features to hide or remove | Owner, 25 Oct | **Answered** 25 Oct | 7 tabs; Pre-orders and Messages kept; Analytics, Pola, Strategic and the rack board removed; owner override is a tick box with no reason. [[Screens]], B31–B32 |
 | OL-29 | How the AI team connects | Owner, 25 Oct | **Answered** 25 Oct | The repo is the shared workspace. Codex connects to GitHub; Antigravity works in the local clone; Grok reviews manually from packets Claude prepares (the owner has a paid Grok subscription since 26 Oct; chat, not API). |
 | OL-30 | Codex connected to GitHub (owner, 26 Oct). First tasks: issues #7 (T-012), #8 (T-037), #9 (T-003b) | Owner/Claude, 26 Oct | **Waiting on owner** to start each in Codex (base branch `claude/clever-noether-tta7o2`) | Codex PRs go into the work branch, then a Grok packet, then Claude's verdict |
+
+| OL-31 | Issues #7 (T-012), #8 (T-037), #9 (T-003b) implementation | Owner, 26 Oct | **Waiting on Grok then Claude** | Builder implementations and local evidence in ticket Handoff Packets; no production changes. Owner has started all three (answers OL-30 for these tasks). |
diff --git a/kos/05-Work/Master-Plan.md b/kos/05-Work/Master-Plan.md
index ac9d352..2897120 100644
--- a/kos/05-Work/Master-Plan.md
+++ b/kos/05-Work/Master-Plan.md
@@ -55,11 +55,11 @@ GO requires:
 | T-033 | **Replay section (B20):** video, transcript, host-call timeline (tap to jump), orders per event, item stories | Antigravity | Grok, Claude | T-031 |
 | T-035 | **Orders review page and buyer view** ([[Screens]] §3–5): grouped by buyer, counts, store match box, filters, order lines plus evidence | Antigravity | Grok, Claude | T-013 |
 | T-036 | **Invoice generator, all in one screen** ([[Screens]] §6): preview with a proof panel, tap-to-edit (no reason field; original kept in the story), take photo (existing camera feature), message field, send the invoice picture plus the bag photo in Messenger | Antigravity | Grok, Claude | T-035, T-037 |
-| T-037 | **Port the shop's invoice template renderer** (`bangkokplussizeootd/lib/invoice-artwork.ts`): picture pages, "Page x of y", QRs from settings, one line per item with quantity, item text from the host's call | Codex | Grok, Claude | — |
+| T-037 | **In review.** **Port the shop's invoice template renderer** (`bangkokplussizeootd/lib/invoice-artwork.ts`): picture pages, "Page x of y", QRs from settings, one line per item with quantity, item text from the host's call | Codex | Grok, Claude | — |
 | T-038 | **Match report for the trial weeks (B30):** after each live, the portal's final orders against the invoices actually sent in Messenger and the store owner's total, listing matched / extra / missed | Codex | Claude | T-013 |
 | T-039 | **DONE on the branch 25 Oct (not deployed; Grok review pending).** **Tabs and clean-up** ([[Screens]], decided 25 Oct): 7 tabs (Live, Replay, Orders, Pre-orders, Invoices, Payments & Shipping, Messages). Remove Analytics, Pola AI, Strategic analysis and the rack board. Owner override becomes a tick box with no reason field. | Antigravity | Grok, Claude | — |
 | T-034 | **Live Session section (B21):** clean when idle; appears automatically on live start; closes and clears automatically on live end (data moves on, nothing deleted) | Antigravity | Grok, Claude | T-032 |
-| T-012 | **W2:** Segments and Job 1 per segment as pure functions (codes from host events only; extra pieces; repeated mine), with unit tests built from real comment text | Codex | Grok, Claude | — |
+| T-012 | **In review. W2:** Segments and Job 1 per segment as pure functions (codes from host events only; extra pieces; repeated mine), with unit tests built from real comment text | Codex | Grok, Claude | — |
 | T-013 | **W2:** Job 2 per order (count mentions, type them, latest granted change is final), item story, first miner, bag list | Antigravity | Grok, Claude | — |
 | T-014 | **W2:** golden test harness: fixture in, final orders out, diff against the owner's list | Codex | Claude | T-002 |
 | T-015 | **W3:** invoices built from final orders; one invoice per live per buyer; owner approval; mark-sent starts the 24h; fix the wording in KI-011 | Antigravity | Grok, Claude | T-013 |
@@ -152,3 +152,5 @@ Self-check reasoning:
 Conditions before G1 passes:
 - the owner's answers to Q1–Q9;
 - a fixture for the golden test.
+
+| T-003b | **In review:** knowledge-base PR check; implementation and local git-fixture validation complete | Codex | Grok, Claude | Owner enables branch protection later |
diff --git a/kos/05-Work/Tickets/T-003b.md b/kos/05-Work/Tickets/T-003b.md
new file mode 100644
index 0000000..a8f0d3f
--- /dev/null
+++ b/kos/05-Work/Tickets/T-003b.md
@@ -0,0 +1,66 @@
+# T-003b · Require a knowledge base update
+
+Status: in review (G3/G4 pending).
+
+## Context and checkpoints
+
+- G0: Read AGENTS.md, START-HERE, Live-Selling-Business, Lessons,
+  Open-Loop, Current-State, Known-Issues, Master-Plan and the engineering
+  loop, especially its KOS update requirement. Read GitHub issue #9.
+- G1: The existing CI has no KOS check. Add the issue's filename-presence
+  check on pull requests, using only checkout plus a shell script. No
+  production or branch protection changes. Issue #9 authorizes this build;
+  independent Grok and Claude review remain pending.
+- G2: Workflow added; validation evidence below.
+
+## Handoff Packet
+
+1. **What I did:** Added `.github/workflows/kos-check.yml`. It compares the
+   PR head with its base using `git diff --name-only`, and fails exactly
+   when files outside `kos/` changed without any changed path in `kos/`.
+   The `kos-check` job has read-only contents permissions and uses only
+   `actions/checkout@v4`, with credentials not persisted.
+2. **Why this is the real solution:** Existing `ci.yml` runs build/tests
+   but has no knowledge-base check. Comparing the PR's merge base to its
+   actual head isolates the PR changes, including after the target branch
+   advances. NUL-delimited paths and disabled rename detection prevent
+   spaces, newlines and renames from misclassifying file locations.
+   No new action or dependency is needed. This follows issue #9's simple
+   presence rule; it does not claim to inspect documentation quality.
+3. **Evidence:** See validation results below. Commit and PR links are
+   supplied by the parent handoff when the changes are committed.
+4. **Tests:** Executed the actual workflow shell against temporary git
+   histories; no persistent application test or dependency is added.
+5. **Risks and unknowns:** A changed `kos/` path can be a deletion; the
+   rule deliberately checks paths, as specified in issue #9. Enforcing
+   particular documents or substantive content is outside this issue.
+   The GitHub-hosted run remains unverified until the PR runs.
+6. **What I did not do:** No change to `ci.yml`, branch protection,
+   application code, production, secrets, or deployment.
+7. **Next role:** Grok adversarial review, then Claude evaluator. Owner
+   enables branch protection later. Parent updates Master-Plan,
+   Current-State and the Open-Loop ledger alongside this ticket.
+
+## Validation results
+
+`python work/t003b/validate.py` passed. Parsed YAML successfully (PyYAML
+6.0.3); checked that checkout is the only action and `ci.yml` is unchanged.
+The actual workflow shell produced these results against disposable git
+histories:
+
+| Scenario | Exit |
+|---|---|
+| Code only | 1 (required failure message) |
+| KOS only | 0 |
+| Code and KOS | 0 |
+| No changed files | 0 |
+| `kos-other/` only | 1 |
+| Outside filename with spaces | 1 |
+| Outside filename containing newline and `kos/` | 1 |
+| Rename outside KOS | 1 |
+| Rename from KOS to outside | 0 (both paths count, per presence rule) |
+| Code only, unrelated KOS change on advanced PR base | 1 |
+| Invalid base SHA | Nonzero (fails closed) |
+
+The tests are local fixture checks, not a GitHub Actions run. No production
+verification is claimed.
diff --git a/kos/05-Work/Tickets/T-012.md b/kos/05-Work/Tickets/T-012.md
new file mode 100644
index 0000000..cc8d22f
--- /dev/null
+++ b/kos/05-Work/Tickets/T-012.md
@@ -0,0 +1,36 @@
+# T-012 · Segments and Job 1
+
+G0: Read AGENTS, START-HERE, Live-Selling-Business, Open-Loop, Lessons,
+Current-State, Known-Issues, Master-Plan, engineering loop and legacy handoff.
+Issue #7 assigns the pure-function implementation to Codex on the work branch.
+
+G1: Existing orderIntent evaluates comments without host events (KI-002).
+Implement isolated host-derived matching and chronological captures; preserve
+unclear evidence. No routes or UI. Tests cover issue examples, boundaries,
+clarifications, duplicate delivery, cross-channel repeats and host defaults.
+G2 checkpoint: baseline lint saved in work/lint-before.txt (23 diagnostics).
+G3/G4 remain for Grok and Claude; builder supplies evidence, not a verdict.
+
+## Handoff Packet
+
+1. What I did: added `server/liveEngine/{types,segments,job1}.ts` and
+   `tests/liveEngine.test.ts`; updated the work plan, state and Open-Loop OL-31.
+2. Why this is the real solution: the old parser has no host context. This API
+   derives eligible codes and metadata exclusively from already-called host
+   events, while eventSeq describes placement rather than item eligibility.
+   Guessing current-event codes for bare MINE and using chat-derived vocabulary
+   were rejected (B6, L-007, L-009). Tests pin host eligibility and chronology.
+3. Evidence: `npm test` passed (53 Node tests, zero failures, plus reconciliation
+   integration suite); `npm run build` passed. `npm run lint` has the same 23
+   diagnostics as the pre-change baseline (`diff` of captured outputs empty).
+4. Tests: nine Job 1/segments tests cover every issue example plus boundary,
+   duplicate-delivery and cross-channel cases. A first run caught a pre-live
+   duplicate-ID suppression bug; corrected and all tests pass.
+5. Risks: synthetic Taglish tests are not real-live golden verification. Caller
+   must supply only messages during this live because the requested two-argument
+   job1 API has no end timestamp. Ambiguous size/colour options remain undefined;
+   no-code extra pieces with several possible codes remain unclear. Names link
+   channels per B25. Captures are candidates, not approved orders.
+6. Not done: Job 2, approval, evidence screenshots, UI/routes, data writes,
+   deployments, or independent review. No real buyer names in fixtures.
+7. Next role: Grok adversarial review, then Claude evaluator. OL-31 remains open.
diff --git a/kos/05-Work/Tickets/T-037.md b/kos/05-Work/Tickets/T-037.md
new file mode 100644
index 0000000..2eae4a4
--- /dev/null
+++ b/kos/05-Work/Tickets/T-037.md
@@ -0,0 +1,44 @@
+# T-037 · Invoice artwork · in progress
+
+G0: Read AGENTS.md first, then START-HERE and Live-Selling-Business; read
+Screens, Open-Loop, Lessons, Current-State, Known-Issues, Master-Plan and
+KOS-MASTER-PLAN-PROMPT. Read issue #8 and reference renderer and finance helpers.
+
+G1: Port the reference canvas drawing with unchanged branding and dimensions.
+Replace old portal state dependencies with explicit plain data. Group code,
+size, colour and unit price; derive amounts in integer cents. Extract pure
+pagination used by the renderer and test grouping, titles, wrapping and pages.
+No UI or Messenger changes. G3/G4 are pending independent Grok/Claude review.
+
+G2 checkpoint: renderer port and pure helpers implemented; focused Node tests
+pass via `node --import tsx --test tests/invoiceArtwork.test.ts`. The tsx CLI
+cannot create its IPC pipe in the sandbox (EPERM); use the Node loader instead.
+Preparing actual Chromium canvas SAMPLE screenshot and checking lint.
+
+## Handoff Packet
+
+1. What I did: ported `src/utils/invoiceArtwork.ts` from the reference drawing;
+   added `tests/invoiceArtwork.test.ts` and `docs/samples/invoice-SAMPLE.png`.
+   Source work remains on `claude/clever-noether-tta7o2`; parent handles PR.
+2. Why this is the real solution: the approved template previously existed only
+   in `reference/` and depended on old portal state. The port retains its exact
+   page dimensions, fonts, colours, blocks, QR slots and footer. Explicit data
+   replaces global state. Grouping by code/size/colour/unit price and integer-cent
+   arithmetic prevent repeated pieces or floating-point sums changing totals.
+   A redesigned template or importing old state would miss issue #8's intent.
+3. Evidence: `node --import tsx tests/invoiceArtwork.test.ts`: 6 tests, 6 pass,
+   0 fail. `npm run lint`: 23 baseline diagnostics, no new diagnostics in artwork.
+   Local Chromium rendered the sample in 1 page; a 40-distinct-row sample rendered
+   in 4 pages; `joinedImage` returned JPEG. Screenshot viewed and layout checked.
+   `npm run build`: passes (see parent's combined validation).
+4. Tests cover grouping, differing variants/prices, monetary amounts, invalid
+   inputs, both invoice titles, host-derived item text, caller-only QR slots,
+   wrapping, exact page boundaries, overflowing pages and page numbering.
+5. Risks: browser fonts and QR image load failures can affect rendering; images
+   must be readable by the browser. Dates are displayed in Manila time to match
+   the approved reference. This input has no payments/credits; balance is the
+   amount due for the supplied invoice. No production claim is made.
+6. Did not wire the UI, send Messenger messages, store QR details, mutate settings,
+   change deadlines, or deploy. No real buyer data was used.
+7. Next role: Grok adversarial review, then Claude evaluator. Parent records
+   T-037 in review in Master-Plan and waiting review in Open-Loop/Current-State.
diff --git a/server/liveEngine/job1.ts b/server/liveEngine/job1.ts
new file mode 100644
index 0000000..b6c0f3e
--- /dev/null
+++ b/server/liveEngine/job1.ts
@@ -0,0 +1,95 @@
+import type { Capture, ItemEvent, RawMessage, Unclear } from './types';
+import { orderedEvents } from './segments';
+
+const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
+const flexible = (s: string) => [...s.replace(/\s/g, '')].map(escape).join('\\s*');
+const mine = /\b(?:pa\s*)?m[iy1]ne(?=\b|[a-z0-9])/i;
+const nonOrder = /\?|\b(?:magkano|mgkano|hm|how much|available|meron|mayroon|cancel|palit|change|swap|ganda|maganda|malambot|thank|salamat)\b/i;
+const extraPattern = /\+\s*(\d+)\b|\b(one|two|\d+)\s+more\b|\badd\s+(\d+)\b/i;
+const buyerKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
+const codeKey = (code: string) => code.replace(/\s/g, '').toLocaleLowerCase();
+
+function option(text: string, values: readonly string[]): string | undefined {
+  return [...values].sort((a, b) => b.length - a.length).find(value =>
+    new RegExp(`(?<![a-z0-9])${flexible(value)}(?![a-z0-9])`, 'i').test(text));
+}
+function extraQty(text: string): number | undefined {
+  const match = text.match(extraPattern);
+  if (!match) return undefined;
+  const word = match[1] ?? match[2] ?? match[3];
+  const qty = word.toLowerCase() === 'one' ? 1 : word.toLowerCase() === 'two' ? 2 : Number(word);
+  return Number.isSafeInteger(qty) && qty > 0 ? qty : undefined;
+}
+
+/** Messages must already be scoped to this live (the two-argument API has no end time).
+ * Captures are candidates for Job 2, not approved/final orders.
+ */
+export function job1(events: readonly ItemEvent[], messages: readonly RawMessage[]): { captures: Capture[]; unclear: Unclear[] } {
+  const host = orderedEvents(events);
+  const captures: Capture[] = [];
+  const unclear: Unclear[] = [];
+  const seen = new Set<string>();
+  for (const message of [...messages].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
+    const time = Date.parse(message.at);
+    if (!Number.isFinite(time)) throw new Error('Invalid message timestamp');
+    const delivery = `${message.channel}:${message.id}`;
+    if (seen.has(delivery)) continue;
+    const called = host.filter(e => Date.parse(e.calledAt) <= time);
+    const current = called.at(-1);
+    if (!current) continue;
+    seen.add(delivery);
+    // Repeated host calls update metadata without introducing a chat-derived code.
+    const known = new Map(called.map(e => [codeKey(e.code), e]));
+    const text = message.text;
+    if (nonOrder.test(text)) continue;
+    const hasMine = mine.test(text);
+    const matches = [...known.values()].flatMap(event => {
+      const pattern = new RegExp(`(?<![a-z0-9])${flexible(event.code)}(?![a-z0-9])`, 'i');
+      const match = pattern.exec(text.replace(mine, ' '));
+      return match ? [{ event, match }] : [];
+    });
+    const buyer = buyerKey(message.name);
+    const previous = captures.filter(c => buyerKey(c.buyer) === buyer);
+    const explicitExtra = extraQty(text);
+    let selected = matches.map(m => m.event);
+    if (!selected.length && explicitExtra && !text.replace(extraPattern, '').replace(/\b(?:po|pls|please)\b|[^\p{L}\p{N}]/giu, '')) {
+      const codes = [...new Set(previous.map(c => codeKey(c.code)))];
+      if (codes.length === 1) selected = [known.get(codes[0])!];
+    }
+    if (!selected.length) {
+      if (hasMine || explicitExtra) unclear.push({ buyer: message.name, messageId: message.id,
+        at: message.at, text, eventSeq: current.seq, channel: message.channel,
+        reason: explicitExtra ? 'ambiguous_extra' : 'missing_code' });
+      continue;
+    }
+    for (const event of selected) {
+      const stripped = text.replace(mine, ' ').replace(new RegExp(flexible(event.code), 'i'), ' ');
+      const size = option(stripped, event.sizes);
+      const colour = option(stripped, event.colours);
+      // Without MINE, permit code/specification replies and polite particles only.
+      let remainder = stripped;
+      for (const value of [...event.sizes, ...event.colours].sort((a, b) => b.length - a.length))
+        remainder = remainder.replace(new RegExp(`(?<![a-z0-9])${flexible(value)}(?![a-z0-9])`, 'ig'), ' ');
+      remainder = remainder.replace(extraPattern, ' ').replace(/\b(?:po|pls|please|pa|ako|mine)\b|\b\d+\b|[^\p{L}\p{N}]/giu, '');
+      if (!hasMine && remainder) continue;
+      const afterCode = text.replace(mine, ' ').match(new RegExp(`${flexible(event.code)}\\s+(\\d+)\\s*(?:po|pls|please)?[.!]*$`, 'i'));
+      const suffixQty = afterCode ? Number(afterCode[1]) : undefined;
+      const qty = explicitExtra ?? (suffixQty && Number.isSafeInteger(suffixQty) ? suffixQty : undefined);
+      const already = previous.some(c => codeKey(c.code) === codeKey(event.code));
+      if (already && !qty) continue;
+      // Only an unambiguous code-only or MINE+code reply resolves pending MINEs.
+      const pending = selected.length === 1 && !qty && !remainder
+        ? unclear.filter(u => buyerKey(u.buyer) === buyer && u.reason === 'missing_code') : [];
+      const originalText = pending.map(u => u.text).join(' ');
+      captures.push({ buyer: message.name, code: event.code, price: event.price,
+        size: size ?? option(originalText, event.sizes) ?? (event.sizes.length === 1 ? event.sizes[0] : undefined),
+        colour: colour ?? option(originalText, event.colours) ?? (event.colours.length === 1 ? event.colours[0] : undefined),
+        qty: qty ?? 1, messageId: message.id, at: message.at, eventSeq: current.seq,
+        channel: message.channel, kind: qty ? 'extra' : 'first',
+        ...(pending.length ? { clarifiedMessageIds: pending.map(u => u.messageId) } : {}),
+      });
+      for (const entry of pending) unclear.splice(unclear.indexOf(entry), 1);
+    }
+  }
+  return { captures, unclear };
+}
diff --git a/server/liveEngine/segments.ts b/server/liveEngine/segments.ts
new file mode 100644
index 0000000..ce957c7
--- /dev/null
+++ b/server/liveEngine/segments.ts
@@ -0,0 +1,24 @@
+import type { ItemEvent, Segment } from './types';
+
+export function orderedEvents(events: readonly ItemEvent[]): ItemEvent[] {
+  const sorted = [...events].sort((a, b) => Date.parse(a.calledAt) - Date.parse(b.calledAt));
+  const seqs = new Set<number>();
+  for (const event of sorted) {
+    if (!Number.isFinite(Date.parse(event.calledAt)) || !event.code.trim() || seqs.has(event.seq))
+      throw new Error('Invalid host event timestamp, code or duplicate sequence');
+    seqs.add(event.seq);
+  }
+  return sorted;
+}
+
+/** Half-open search segments [startAt, endAt); never item eligibility windows. */
+export function segments(events: readonly ItemEvent[], liveEndedAt: string): Segment[] {
+  const sorted = orderedEvents(events);
+  const end = Date.parse(liveEndedAt);
+  if (!Number.isFinite(end) || sorted.some(e => Date.parse(e.calledAt) > end))
+    throw new Error('Invalid live end');
+  return sorted.map((event, i) => ({
+    eventSeq: event.seq, startAt: event.calledAt,
+    endAt: sorted[i + 1]?.calledAt ?? liveEndedAt,
+  }));
+}
diff --git a/server/liveEngine/types.ts b/server/liveEngine/types.ts
new file mode 100644
index 0000000..faf4f25
--- /dev/null
+++ b/server/liveEngine/types.ts
@@ -0,0 +1,46 @@
+/** Host calls are the only source of the live's item vocabulary. */
+export interface ItemEvent {
+  seq: number;
+  code: string;
+  price: number | null;
+  sizes: string[];
+  colours: string[];
+  description?: string;
+  calledAt: string;
+}
+export interface RawMessage {
+  id: string;
+  at: string;
+  name: string;
+  text: string;
+  channel: 'live_chat' | 'messenger';
+}
+export interface Segment {
+  eventSeq: number;
+  startAt: string;
+  endAt: string;
+}
+export interface Capture {
+  buyer: string;
+  code: string;
+  price: number | null;
+  size?: string;
+  colour?: string;
+  qty: number;
+  messageId: string;
+  at: string;
+  eventSeq: number;
+  channel: RawMessage['channel'];
+  kind: 'first' | 'extra';
+  /** Original no-code evidence, when this message clarified it. */
+  clarifiedMessageIds?: string[];
+}
+export interface Unclear {
+  buyer: string;
+  messageId: string;
+  at: string;
+  text: string;
+  eventSeq: number;
+  channel: RawMessage['channel'];
+  reason: 'missing_code' | 'ambiguous_extra';
+}
diff --git a/src/utils/invoiceArtwork.ts b/src/utils/invoiceArtwork.ts
new file mode 100644
index 0000000..5b961c3
--- /dev/null
+++ b/src/utils/invoiceArtwork.ts
@@ -0,0 +1,202 @@
+/** Port of the shop-approved reference invoice renderer; no reference imports or shop state. */
+export interface InvoiceLineInput {
+  code: string;
+  description?: string;
+  size?: string;
+  colour?: string;
+  unitPrice: number;
+  qty: number;
+}
+export interface InvoiceLine extends InvoiceLineInput { amount: number }
+export interface InvoiceArtworkInput {
+  buyerName: string;
+  kind: 'live' | 'preorder';
+  number: string;
+  status: string;
+  liveTitle?: string;
+  liveDate?: string;
+  invoiceDate: string;
+  dueDate: string;
+  lines: readonly InvoiceLineInput[];
+  shipping: number;
+  paymentQRs?: readonly PaymentQRSlot[];
+}
+const cents = (value: number): number => {
+  const n = Math.round(value * 100);
+  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(n) || Math.abs(value * 100 - n) > 0.000001)
+    throw new Error('Money must be nonnegative with at most two decimal places.');
+  return n;
+};
+const safeMoney = (value: number): number => {
+  if (!Number.isSafeInteger(value)) throw new Error('Invoice amount is too large.');
+  return value / 100;
+};
+export const php = (value: number): string => new Intl.NumberFormat('en-PH', {
+  style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2,
+}).format(value);
+export const invoiceTitle = (kind: InvoiceArtworkInput['kind']): string =>
+  kind === 'live' ? 'LIVE ORDER INVOICE' : 'PRE-ORDER INVOICE';
+
+/** The caller supplies host-derived fields; buyer comment text is never an input. */
+export function groupInvoiceLines(lines: readonly InvoiceLineInput[]): InvoiceLine[] {
+  const grouped = new Map<string, InvoiceLine>();
+  for (const line of lines) {
+    if (!line.code.trim() || !Number.isSafeInteger(line.qty) || line.qty < 1)
+      throw new Error('An invoice line needs an item code and positive whole quantity.');
+    const price = cents(line.unitPrice);
+    const key = JSON.stringify([line.code, line.size ?? '', line.colour ?? '', price]);
+    const previous = grouped.get(key);
+    const qty = (previous?.qty ?? 0) + line.qty;
+    if (!Number.isSafeInteger(qty)) throw new Error('Quantity is too large.');
+    grouped.set(key, { ...(previous ?? line), qty, amount: safeMoney(price * qty) });
+  }
+  return [...grouped.values()];
+}
+export function invoiceTotals(lines: readonly InvoiceLineInput[], shipping: number) {
+  const items = groupInvoiceLines(lines);
+  const subtotalCents = items.reduce((sum, line) => sum + cents(line.amount), 0);
+  const total = safeMoney(subtotalCents + cents(shipping));
+  return { lines: items, subtotal: safeMoney(subtotalCents), shipping, total, balance: total };
+}
+const dateLabel = (value: string): string => new Intl.DateTimeFormat('en-GB', {
+  timeZone: 'Asia/Manila', day: '2-digit', month: 'short', year: 'numeric',
+  hour: '2-digit', minute: '2-digit', hour12: true,
+}).format(new Date(value)) + ' PHT';
+
+/** Pure pagination shared with canvas drawing. Rows remain whole, as in the reference. */
+export function rowNeedsPage(y: number, height: number, startAt: number, bodyEnd = BODY_END): boolean {
+  if (!Number.isFinite(height) || height < 0 || height > bodyEnd - startAt)
+    throw new Error('A row is too tall for an invoice page.');
+  return y + height > bodyEnd;
+}
+export function pageLabel(index: number, count: number): string { return `Page ${index + 1} of ${count}`; }
+export function splitPages(heights: readonly number[], startAt = 301, bodyEnd = BODY_END) {
+  const pages: number[][] = [[]];
+  let y = startAt;
+  heights.forEach((height, index) => {
+    if (rowNeedsPage(y, height, startAt, bodyEnd)) { pages.push([]); y = startAt; }
+    pages.at(-1)!.push(index); y += height;
+  });
+  return pages.map((rows, index) => ({ rows, label: pageLabel(index, pages.length) }));
+}
+
+export type PaymentQRSlot = { id: string; active: { account: string; number: string; image: string } | null };
+export type PrintBlock = { text?: string; columns?: string[]; bold?: boolean; pink?: boolean; image?: string; paymentQRs?: PaymentQRSlot[] };
+export const W = 1200, H = 1697, M = 76, BODY_END = 1560;
+/** Breaks text into lines between words; only a single word wider than the line is split by character. */
+export function wrapWords(text: string, width: number, measure: (s: string) => number): string[] {
+  const out: string[] = [];
+  for (const paragraph of text.split("\n")) {
+    let line = "";
+    for (const word of paragraph.match(/\s*\S+\s*/g) ?? []) {
+      if (line && measure(line + word.trimEnd()) > width) { out.push(line.trimEnd()); line = word.trimStart(); } else line += word;
+      while (line.length > 1 && measure(line.trimEnd()) > width) {
+        let cut = line.length - 1;
+        while (cut > 1 && measure(line.slice(0, cut)) > width) cut--;
+        out.push(line.slice(0, cut)); line = line.slice(cut);
+      }
+    }
+    out.push(line.trimEnd());
+  }
+  return out;
+}
+const wrap = (ctx: CanvasRenderingContext2D, text: string, width: number) => wrapWords(text, width, s => ctx.measureText(s).width);
+async function readImage(url: string): Promise<HTMLImageElement> { return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error("Receipt image could not be rendered.")); img.src = url; }); }
+export async function renderBranded(title: string, subtitle: string, blocks: PrintBlock[]): Promise<HTMLCanvasElement[]> {
+  await document.fonts.ready;
+  const pages: HTMLCanvasElement[] = []; let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, y: number;
+  let pageStart = 0;
+  const page = () => {
+    canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H; ctx = canvas.getContext("2d")!;
+    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = "#cf1d72"; ctx.lineWidth = 3; ctx.strokeRect(34, 34, W - 68, H - 68);
+    ctx.fillStyle = "#cf1d72"; ctx.font = "bold 38px Arial"; ctx.fillText("Bangkok Plus Size OOTD", M, 110);
+    ctx.font = "19px Arial"; ctx.fillStyle = "#625662"; ctx.fillText("Since 2021  |  Bangkok to Philippines", M, 146);
+    ctx.fillStyle = "#cf1d72"; ctx.fillRect(M, 170, W - M * 2, 3);
+    ctx.fillStyle = "#25212c"; ctx.font = "bold 29px Arial"; ctx.fillText(title, M, 216);
+    ctx.font = "19px Arial"; ctx.fillStyle = "#625662";
+    const sub = wrap(ctx, subtitle, W - 2 * M); sub.forEach((s, i) => ctx.fillText(s, M, 249 + 24 * i)); y = 277 + sub.length * 24; pageStart = y;
+    pages.push(canvas);
+  };
+  page();
+  for (const block of blocks) {
+    if (block.paymentQRs) {
+      const slots = block.paymentQRs;
+      const width = (W - 2 * M - 24 * 2) / 3;
+      const images = await Promise.all(slots.map(s => s.active ? readImage(s.active.image) : null));
+      ctx!.font = "18px Arial";
+      const labels = slots.map(s => wrap(ctx!, s.active ? `${s.active.account}\n${s.active.number}` : "QR not configured", width - 24));
+      const height = 322 + Math.max(...labels.map(l => l.length), 1) * 23;
+      if (rowNeedsPage(y!, height + 20, pageStart)) page();
+      slots.forEach((s, i) => {
+        const x = M + i * (width + 24), img = images[i];
+        ctx!.strokeStyle = "#efc4d7"; ctx!.lineWidth = 1; ctx!.strokeRect(x, y!, width, height);
+        ctx!.fillStyle = "#a71053"; ctx!.font = "bold 21px Arial";
+        ctx!.fillText(s.id === "gcash" ? "GCash" : s.id === "maya" ? "Maya" : "Bank / InstaPay", x + 12, y! + 30);
+        if (img) {
+          const ratio = Math.min((width - 32) / img.width, 260 / img.height);
+          ctx!.imageSmoothingEnabled = false;
+          ctx!.drawImage(img, x + (width - img.width * ratio) / 2, y! + 45 + (260 - img.height * ratio) / 2, img.width * ratio, img.height * ratio);
+          ctx!.imageSmoothingEnabled = true;
+        }
+        ctx!.fillStyle = "#25212c"; ctx!.font = "18px Arial";
+        labels[i].forEach((line, j) => ctx!.fillText(line, x + 12, y! + 322 + 23 * j));
+      });
+      y! += height + 20; continue;
+    }
+    if (block.image) {
+      const img = await readImage(block.image); const ratio = Math.min((W - M * 2) / img.width, 440 / img.height); const height = img.height * ratio;
+      if (rowNeedsPage(y!, height + 24, pageStart)) page();
+      ctx!.drawImage(img, M, y!, img.width * ratio, height); y! += height + 24; continue;
+    }
+    const cols = block.columns ?? [block.text ?? ""]; const widths = cols.length === 4 ? [580, 95, 165, 208] : cols.length === 2 ? [730, 318] : [W - 2 * M];
+    ctx!.font = `${block.bold ? "bold " : ""}20px Arial`;
+    const lines = cols.map((c, i) => wrap(ctx!, c, widths[i] - 24)); const height = Math.max(...lines.map(l => l.length)) * 26 + 18;
+    if (height > BODY_END - 350) throw new Error("A description is too long for an invoice page. Shorten it before exporting.");
+    if (rowNeedsPage(y!, height, pageStart)) page();
+    ctx!.font = `${block.bold ? "bold " : ""}20px Arial`; ctx!.fillStyle = block.pink ? "#fff0f6" : "#ffffff";
+    ctx!.fillRect(M - 10, y! - 3, W - 2 * M + 20, height); ctx!.fillStyle = block.pink ? "#a71053" : "#25212c";
+    let x = M; lines.forEach((ls, i) => { ls.forEach((l, j) => ctx!.fillText(l, x, y! + 22 + j * 26)); x += widths[i]; });
+    ctx!.strokeStyle = "#efd9e3"; ctx!.lineWidth = 1; ctx!.beginPath(); ctx!.moveTo(M, y! + height); ctx!.lineTo(W - M, y! + height); ctx!.stroke(); y! += height;
+  }
+  pages.forEach((p, index) => { const c = p.getContext("2d")!; c.fillStyle = "#625662"; c.font = "17px Arial"; c.fillText("Bangkok Plus Size OOTD  |  Please keep this document for your records.", M, 1610); c.fillText(pageLabel(index, pages.length), W - 225, 1610); });
+  return pages;
+}
+
+export function invoiceBlocks(input: InvoiceArtworkInput): PrintBlock[] {
+  const a = invoiceTotals(input.lines, input.shipping);
+  const rows: PrintBlock[] = [
+    { text: 'BILL TO: ' + input.buyerName, bold: true, pink: true },
+    ...([input.liveTitle, input.liveDate].some(Boolean) ? [{ columns: ['Live', [input.liveTitle, input.liveDate].filter(Boolean).join(' · ')] }] : []),
+    { columns: ['Invoice date', dateLabel(input.invoiceDate)] },
+    { columns: ['Payment due', dateLabel(input.dueDate)] },
+    { columns: ['Payment window', '24 hours'] },
+    { columns: ['ITEM / SIZE', 'QTY', 'UNIT PRICE', 'AMOUNT'], bold: true, pink: true },
+  ];
+  for (const line of a.lines) {
+    const item = [line.code, line.description].filter(Boolean).join(' ')
+      + (line.colour ? ' · ' + line.colour : '');
+    rows.push({ columns: [[item, line.size || 'Size not specified'].join('\n'),
+      String(line.qty), php(line.unitPrice), php(line.amount)] });
+  }
+  rows.push(
+    { columns: ['Subtotal', php(a.subtotal)] },
+    { columns: ['Shipping', php(a.shipping)] },
+    { columns: ['INVOICE TOTAL', php(a.total)], bold: true, pink: true },
+    { columns: ['THIS INVOICE BALANCE', php(a.balance)], bold: true, pink: true },
+    { text: 'MODE OF PAYMENT — SHOP-APPROVED QR CODES', bold: true, pink: true },
+    { paymentQRs: ['gcash', 'maya', 'bank'].map(id => ({ id, active: input.paymentQRs?.find(s => s.id === id)?.active ?? null })) },
+    { text: 'Please check the recipient and amount in your payment app before paying. Send your payment screenshot/photo in Messenger. Payment is recorded after the proof is checked.' },
+    { text: 'Payment QRs are sent only by the shop in Messenger. Never pay a QR posted in comments.' },
+  );
+  return rows;
+}
+export function invoiceArtwork(input: InvoiceArtworkInput): Promise<HTMLCanvasElement[]> {
+  return renderBranded(invoiceTitle(input.kind), `${input.number}  |  ${input.status}`, invoiceBlocks(input));
+}
+export function joinedImage(pages: HTMLCanvasElement[]): string {
+  if (!pages.length) throw new Error("No invoice pages to preview.");
+  const scale = Math.min(1, 15000 / (H * pages.length)); const c = document.createElement("canvas"); c.width = Math.round(W * scale); c.height = Math.round(H * pages.length * scale);
+  const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); pages.forEach((p, i) => ctx.drawImage(p, 0, i * H * scale, W * scale, H * scale));
+  let image = c.toDataURL("image/jpeg", .9); if (image.length > 1_390_000) image = c.toDataURL("image/jpeg", .65);
+  if (image.length > 1_390_000) throw new Error("This invoice has too many details for one Messenger image. Download its separate page images and send them manually."); return image;
+}
diff --git a/tests/invoiceArtwork.test.ts b/tests/invoiceArtwork.test.ts
new file mode 100644
index 0000000..d464e95
--- /dev/null
+++ b/tests/invoiceArtwork.test.ts
@@ -0,0 +1,47 @@
+import { test } from 'node:test';
+import assert from 'node:assert/strict';
+import { groupInvoiceLines, invoiceTotals, invoiceTitle, invoiceBlocks, wrapWords, splitPages, php, type InvoiceArtworkInput } from '../src/utils/invoiceArtwork';
+
+const line = { code: 'T7', description: 'Linen set', size: '3XL', colour: 'Black', unitPrice: 650, qty: 1 };
+const input: InvoiceArtworkInput = { buyerName: 'SAMPLE Buyer A', kind: 'live', number: 'SAMPLE-001', status: 'AWAITING PAYMENT', liveTitle: 'SAMPLE LIVE', liveDate: '25 Oct 2026', invoiceDate: '2026-10-25T08:00:00Z', dueDate: '2026-10-26T08:00:00Z', lines: [line, line, line], shipping: 80 };
+
+test('groups identical host-derived items, retains different sizes, colours and prices', () => {
+  const grouped = groupInvoiceLines([line, { ...line, qty: 2 }, { ...line, size: '2XL' }, { ...line, colour: 'Red' }, { ...line, unitPrice: 700 }]);
+  assert.equal(grouped.length, 4);
+  assert.equal(grouped[0].qty, 3);
+  assert.equal(grouped[0].amount, 1950);
+  const totals = invoiceTotals(input.lines, 80);
+  assert.deepEqual({ subtotal: totals.subtotal, total: totals.total, balance: totals.balance }, { subtotal: 1950, total: 2030, balance: 2030 });
+});
+test('money arithmetic uses cents, rejects invalid amounts and quantities', () => {
+  assert.equal(invoiceTotals([{ ...line, unitPrice: 0.1, qty: 3 }], 0.2).total, 0.5);
+  for (const unitPrice of [-1, NaN, Infinity, 0.001]) assert.throws(() => groupInvoiceLines([{ ...line, unitPrice }]));
+  for (const qty of [0, -1, 1.5, NaN]) assert.throws(() => groupInvoiceLines([{ ...line, qty }]));
+  assert.equal(php(1950), '₱1,950.00');
+});
+test('titles distinguish live and pre-order invoices', () => {
+  assert.equal(invoiceTitle('live'), 'LIVE ORDER INVOICE');
+  assert.equal(invoiceTitle('preorder'), 'PRE-ORDER INVOICE');
+});
+test('invoice blocks use item fields and quantities and only caller-provided payment slots', () => {
+  const blocks = invoiceBlocks(input);
+  assert.ok(blocks.some(b => b.columns?.[0] === 'T7 Linen set · Black\n3XL' && b.columns[1] === '3' && b.columns[3] === '₱1,950.00'));
+  assert.deepEqual(blocks.find(b => b.paymentQRs)?.paymentQRs, ['gcash', 'maya', 'bank'].map(id => ({ id, active: null })));
+  const active = { account: 'SAMPLE', number: 'SAMPLE', image: 'data:image/png;base64,SAMPLE' };
+  assert.deepEqual(invoiceBlocks({ ...input, paymentQRs: [{ id: 'maya', active }] }).find(b => b.paymentQRs)?.paymentQRs?.[1], { id: 'maya', active });
+  assert.ok(blocks.some(b => b.columns?.[0] === 'Payment window' && b.columns[1] === '24 hours'));
+});
+test('wrapWords wraps at words, preserves paragraphs, and splits overlong words', () => {
+  const measure = (s: string) => s.length;
+  assert.deepEqual(wrapWords('Linen set Black', 9, measure), ['Linen set', 'Black']);
+  assert.deepEqual(wrapWords('ABCDE\n\nFG', 3, measure), ['ABC', 'DE', '', 'FG']);
+  assert.deepEqual(wrapWords('', 3, measure), ['']);
+});
+test('pagination fits exact boundaries, continues rows and numbers all pages', () => {
+  assert.deepEqual(splitPages([40, 60, 1, 99, 100], 10, 110), [
+    { rows: [0, 1], label: 'Page 1 of 3' }, { rows: [2, 3], label: 'Page 2 of 3' }, { rows: [4], label: 'Page 3 of 3' },
+  ]);
+  assert.throws(() => splitPages([101], 10, 110), /too tall/);
+  assert.throws(() => splitPages([NaN]), /too tall/);
+  assert.deepEqual(splitPages([]), [{ rows: [], label: 'Page 1 of 1' }]);
+});
diff --git a/tests/liveEngine.test.ts b/tests/liveEngine.test.ts
new file mode 100644
index 0000000..36a1c84
--- /dev/null
+++ b/tests/liveEngine.test.ts
@@ -0,0 +1,92 @@
+import { test } from 'node:test';
+import assert from 'node:assert/strict';
+import { segments } from '../server/liveEngine/segments';
+import { job1 } from '../server/liveEngine/job1';
+import type { ItemEvent, RawMessage } from '../server/liveEngine/types';
+
+// Synthetic host calls and anonymized Taglish examples; not a golden real-live fixture.
+const at = (minute: number) => new Date(Date.UTC(2026, 9, 25, 12, minute)).toISOString();
+const events: ItemEvent[] = [
+  { seq: 1, code: 'T7', price: 650, sizes: ['2XL', '3XL'], colours: ['Black', 'Red'], calledAt: at(0) },
+  { seq: 2, code: 'T3', price: null, sizes: ['XL'], colours: ['Blue'], calledAt: at(10) },
+];
+const msg = (text: string, minute = 1, name = 'Buyer A', id = text, channel: RawMessage['channel'] = 'live_chat'): RawMessage =>
+  ({ id, at: at(minute), name, text, channel });
+
+test('segments are half-open host search filters, sorted without mutating inputs', () => {
+  const reversed = [...events].reverse();
+  assert.deepEqual(segments(reversed, at(20)), [
+    { eventSeq: 1, startAt: at(0), endAt: at(10) },
+    { eventSeq: 2, startAt: at(10), endAt: at(20) },
+  ]);
+  assert.equal(reversed[0].seq, 2);
+  assert.deepEqual(segments([], at(20)), []);
+  assert.throws(() => segments(events, at(5)));
+  assert.throws(() => segments(events, 'invalid'));
+});
+
+test('all match forms, loose spacing, glued MINE and Taglish spellings', () => {
+  for (const text of ['mine T7', 't7', 'T 7 3XL', 'T7 red po', 'myne t7', 'm1ne T 7', 'mineT7']) {
+    const result = job1(events, [msg(text)]);
+    assert.equal(result.captures.length, 1, text);
+    assert.equal(result.captures[0].code, 'T7');
+  }
+  assert.equal(job1(events, [msg('pamine T3', 11)]).captures[0].code, 'T3');
+});
+
+test('host eligibility uses Facebook time and allows old codes in later events', () => {
+  const result = job1(events, [msg('mine T3', 1), msg('mine X99', 2), msg('T7', 10, 'Buyer B'), msg('T7', -1)]);
+  assert.equal(result.captures.length, 1);
+  assert.equal(result.captures[0].eventSeq, 2);
+  assert.equal(result.captures[0].code, 'T7');
+  assert.equal(job1(events, [msg('T70'), msg('AT7'), msg('T7X')]).captures.length, 0);
+});
+
+test('unclear MINE keeps evidence until same buyer clarifies across events/channels', () => {
+  const result = job1(events, [msg('T7', 12, 'Buyer A', 'clarify', 'messenger'),
+    msg('mine 3XL red po', 1, 'Buyer A', 'original'),
+    msg('mine po', 2, 'Buyer B', 'unresolved'), msg('ganda nyan', 3)]);
+  assert.equal(result.captures.length, 1);
+  assert.deepEqual(result.captures[0].clarifiedMessageIds, ['original']);
+  assert.equal(result.captures[0].size, '3XL');
+  assert.equal(result.captures[0].colour, 'Red');
+  assert.equal(result.captures[0].messageId, 'clarify');
+  assert.equal(result.captures[0].eventSeq, 2);
+  assert.deepEqual(result.unclear.map(u => u.messageId), ['unresolved']);
+});
+
+test('extra quantities are pieces; repeated MINE across Messenger remains one', () => {
+  const result = job1(events, [msg('mine T7', 1), msg('mine T7', 2, 'Buyer A', 'repeat', 'messenger'),
+    msg('+1', 3), msg('two more', 4), msg('T7 2', 5), msg('one more T7', 6), msg('add 1 T7', 7)]);
+  assert.deepEqual(result.captures.map(c => [c.kind, c.qty]),
+    [['first', 1], ['extra', 1], ['extra', 2], ['extra', 2], ['extra', 1], ['extra', 1]]);
+  assert.equal(job1(events, [msg('mine T7 2')]).captures[0].kind, 'extra');
+});
+
+test('no-code extras with multiple possible items are retained, never guessed', () => {
+  const result = job1(events, [msg('T7'), msg('T3', 11), msg('+1', 12)]);
+  assert.equal(result.captures.length, 2);
+  assert.equal(result.unclear[0].reason, 'ambiguous_extra');
+});
+
+test('host metadata supplies defaults and price; chat cannot create values', () => {
+  const capture = job1(events, [msg('mine T3 999 green 4XL', 11)]).captures[0];
+  assert.equal(capture.price, null);
+  assert.equal(capture.size, 'XL');
+  assert.equal(capture.colour, 'Blue');
+  const multiple = job1(events, [msg('mine T7')]).captures[0];
+  assert.equal(multiple.size, undefined);
+  assert.equal(multiple.colour, undefined);
+});
+
+test('questions, appreciation and Job 2 changes create no new captures', () => {
+  for (const text of ['magkano T7?', 'hm T7 po', 'ganda nyan', 'maganda T7', 'cancel T7', 'palit T7 red', 'T7 malambot tela', 'thank you T7'])
+    assert.equal(job1(events, [msg(text)]).captures.length, 0, text);
+});
+
+test('Messenger counts equally and duplicate delivery adds nothing, even extras', () => {
+  const extra = msg('T7 +1', 12, 'Buyer A', 'duplicate', 'messenger');
+  const result = job1(events, [msg('T7', 11, 'Buyer A', 'first', 'messenger'), extra, extra]);
+  assert.deepEqual(result.captures.map(c => c.qty), [1, 1]);
+  assert.equal(result.captures[0].channel, 'messenger');
+});
```
