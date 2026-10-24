# Rules for every agent (Claude, Antigravity, Codex, Grok)

1. **Before any work,** read `kos/00-START-HERE.md`, then `kos/01-Project/Live-Selling-Business.md`.
2. **The Live Selling Business is a HARD RULE.**
   - Item codes, prices, colours and sizes come from the host's Item Events, never from the live chat.
   - Orders are matched inside the window between events (Job 1).
   - Each one is then reviewed across the whole chat and Messenger (Job 2).
   - There is no catalogue, rack, stock inventory or pre-defined item code.
3. **Work only inside the Engineering Loop** in `KOS-MASTER-PLAN-PROMPT.md`, gates G0 to G8.
   - Every change updates `kos/` in the same PR.
   - The agent that builds a change never reviews it.
4. **Real numbers only.** Every number needs a query or a source, or it is written as "unknown".
5. **No secrets** in files, commits or chat.
   - No deleting production data, no pushing to `main`, no sending to buyers.
   - Each of those needs the owner.
