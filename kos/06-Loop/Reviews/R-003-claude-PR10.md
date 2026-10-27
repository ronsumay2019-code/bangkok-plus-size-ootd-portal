# R-003 · Claude's evaluator notes on PR #10 (Codex: T-012, T-037, T-003b)

Status: **CHANGES NEEDED**, provisional. The final verdict comes after Grok's independent review (RP-003). These notes were kept out of Grok's packet so its review stays independent.

## Independent checks run by Claude (26 Oct)
- Checked out PR #10 head `01beb80` separately.
- `npm test`: **53/53 pass**.
- `npm run build`: OK.
- `npm run lint`: **23**, the same as the base.
- **Sample invoice image:** made-up data, and it matches the shop's template (header, title, Bill to, table, totals, QR slots, notes, "Page 1 of 1"). The item line reads "T7 Linen set · Black / 3XL", so it comes from the host, not the comment (L-007).
- **kos-check workflow:** logic is correct (fails when code changes without `kos/`), uses only `actions/checkout`, no secrets.

## Findings, from probing `job1` with real-style comments (script: `R-003-probe.ts`; output below)
1. **HIGH: real orders vanish silently.**
   - "mine T7 salamat po", "mine T7 ganda!" and "mine T7 po?" all give **no capture and nothing in unclear**.
   - Cause: the `nonOrder` word list (salamat, ganda, "?", …) vetoes the whole message, even when it has MINE + a called code.
   - Breaks "never drop" (B6), and S7, which says chatter is chatter only when there is no order.
   - **Fix:**
     - MINE + called code is always captured, whatever else is in the message.
     - A question mark with MINE + code goes to `unclear`, not nowhere.
     - Words like palit, change and swap are left for Job 2; they never delete.
2. **MEDIUM-HIGH: a stale unclear "mine" attaches to an unrelated later order and passes on its size.**
   - "mine 2XL" (no code, during T3's event), then 20 minutes later "mine T9", produces T9 **2XL**, and the T3 unclear is closed.
   - Result: the wrong size on the invoice, and a possible missed T3 order.
   - **Fix:**
     - Clarification only links within the same event, or the next one.
     - Never copy size or colour from an unclear message into a different item's order.
     - Keep the unclear when unsure.
3. **MEDIUM: a first order with a quantity is labelled `extra`.**
   - "mine T7 2" as the buyer's first T7 order gives `kind: 'extra'`, qty 2.
   - It should be `first` with qty 2. Otherwise Job 2 or the invoice may treat it as an add-on with no base order.
4. **LOW:**
   - Messages before the first host call are dropped without a trace; they should be listed as pre-live.
   - "three more" (a word) isn't parsed.
   - A numeric-only host code (e.g. "2") would also match the quantity in "mine T7 2". This needs a test if the host ever uses numeric codes.
   - On the invoice, shipping shows ₱0.00 where the shop's sample says "Pending assignment".

## Probe output
```
A. "mine T7 salamat" (order + thanks)             captures: []  unclear: []
B. "mine T7 ganda!" (order + appreciation)        captures: []  unclear: []
C. first order "mine T7 2"                        captures: [{T7, qty 2, kind "extra"}]
D. unclear "mine 2XL" at T3, later "mine T9"      captures: [{T9, size "2XL", clarified ["d1"]}]  unclear: []
E. "mine T7 po?"                                  captures: []  unclear: []
```
