# Rules for every agent (Claude, Antigravity, Codex, Grok)

1. **Before any work,** read `kos/00-START-HERE.md`, then `kos/01-Project/Live-Selling-Business.md`.
2. **The Live Selling Business is a HARD RULE.**
   - Item codes, prices, colours and sizes come from the host's Item Events, never from the live chat.
   - **Follow the host, not the buyers.** Capture each item code the host calls (price, size, colour) first. Then look for orders inside each event, the time from one code call to the next, in the live chat and Messenger (Job 1).
   - Each one is then reviewed across the whole chat and Messenger (Job 2).
   - There is no catalogue, rack, stock inventory or pre-defined item code.
3. **Work only inside the Engineering Loop** in `KOS-MASTER-PLAN-PROMPT.md`, gates G0 to G8.
   - Every change updates `kos/` in the same PR.
   - The agent that builds a change never reviews it.
4. **Real numbers only.** Every number needs a query or a source, or it is written as "unknown".
5. **No secrets** in files, commits or chat.
   - No deleting production data, no pushing to `main`, no sending to buyers.
   - Each of those needs the owner.
6. **Nothing is left unanswered (HARD RULE).**
   - No question, request or task is left unanswered or untouched, in chat or on any platform in this build, before moving to the next topic.
   - Track every item in `kos/04-State/Open-Loop.md`.
   - A topic closes only when its rows are Answered, Done or Parked by the owner.
7. **Meta compliance (HARD RULE).** Read `kos/01-Project/Meta-Compliance.md` before any change that touches Facebook, Messenger or buyer data.
   - Official Graph API only; no scraping, no personal logins, no working around Meta's limits.
   - Messenger sends only within 24 hours of the buyer's last message; buyer data never goes to an outside AI.
8. **Document, govern, learn, reuse (HARD RULE).** Read `kos/02-Method/Reuse-Loop.md`.
   - Every request starts with Reuse, Extend, Fork or New, answered from `kos/07-Releases/Releases.md`.
   - Nothing is called working without evidence checked against the source; only Production-ready entries are reused.
   - A lesson is closed only when it names the guard that catches it next time.
9. **Memory (HARD RULE).** The `kos/` record is the memory; the conversation is not.
   - Every answer starts from the latest record (Current-State, Releases, Known Issues, Open Loop), which hooks load at every message, session start and after every compression.
   - Update the record in the same step as the change it describes (a merge, a failure, an owner decision), never later.
   - Never call anything done, fixed or implemented unless it is on `main` (production). A fix on a branch is "Built, not in production".
   - If the conversation and the record disagree, the record wins until checked against the real system; then correct the record the same day.
   - What the owner asks not to record cannot be remembered after compression; say so when it matters.
