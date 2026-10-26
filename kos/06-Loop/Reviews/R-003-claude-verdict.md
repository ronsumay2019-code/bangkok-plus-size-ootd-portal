# R-003 · Claude's final verdict on PR #10, after Grok (26 Oct)

**Verdict: CHANGES NEEDED. Codex fixes the list below; Claude re-checks; then it merges into the work branch.**

Grok and Claude reviewed independently. Both found the same top defect.

| # | Finding | Found by | Call | Reasoning |
|---|---|---|---|---|
| 1 | An order mixed with thanks, appreciation or a "?" is dropped entirely ("mine T7 salamat po", "mine T7 3XL maganda po", "mine T7 po?") | **Both** | **Fix (High)** | Never drop (B6, B18). Appreciation is chatter only when there is no order (S7). |
| 2 | Code-only or code+size **without "mine"** but with an extra word is dropped ("T7 3XL red po now") | Grok | **Fix (High), with a safety limit** | B6 counts code-only and code+size/colour, "not an exact match". But removing the guard entirely would turn "T7 how much" into an order. **Rule:** code + size or colour is captured. A code with other words and no "mine" goes to **unclear**, never dropped and never captured blind. |
| 3 | A stale unclear "mine 2XL" attaches to an unrelated order 20 minutes later and passes on its size | Claude (probe D) | **Fix (Medium-High)** | Grok tested only the good case, where the clarification comes right after. **Rule:** a clarification links only within the same or next event. A size or colour stated in the clarifying message wins over the earlier one. An inherited size is marked on the evidence. |
| 4 | Messages before the first host call are dropped | Both | **Fix (Medium)** | Never drop. Keep them as unclear with reason `pre_call`; re-check them once the code is called. |
| 5 | A first message with a number ("mine T7 2") is labelled `extra` | Both | **Fix (Medium)**: label `first` with qty N | The exact meaning of a first "+1" is an **owner question** (below). Safe default until answered: first "mine T7 2" means 2 pieces, `first`; first "mine T7 +1" goes to unclear. |
| 6 | Invoice shop name, tagline, "24 hours" and footer are hard-coded | Grok | **Reject** | It's one shop with an approved template, and 24 hours is a business rule (CLAUDE.md). Making them settings adds complexity the owner asked to avoid ("do not complicate things"). QRs correctly come from settings. |
| 7 | kos-check only checks that some file in `kos/` changed | Grok | **Accept as a known limit; no change** | It's the simple rule the ticket asked for. Reviews by Grok and Claude catch empty updates. |
| 8 | Invoice shipping shows ₱0.00 where the shop's sample says "Pending assignment" | Claude | **Fix (Low)** | Let shipping be "pending" and print "Pending assignment", like the shop's sample. |

**Tests Codex must add:** each case above, plus a re-called code with an updated price (Grok).

**Owner questions** (asked 26 Oct; Codex uses the safe defaults until answered):
1. "mine T7 ganda po" is an order, by our reading of S7. Is "T7 red?" with a question mark an order or a question? Default: unclear.
2. As a buyer's **first** message, is "mine T7 2" **2 pieces**? Is "mine T7 +1" **1 piece or 2**? Default: 2 pieces; "+1" goes to unclear.
