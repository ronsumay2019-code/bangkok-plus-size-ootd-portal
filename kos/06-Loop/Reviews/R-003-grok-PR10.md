# R-003 · Grok's review of PR #10 (RP-003), received 26 Oct 2026, verbatim

1. Verdict: CHANGES NEEDED
2. Findings (most serious first)

severity: High
file and line: server/liveEngine/job1.ts lines 7 and 43 (nonOrder regex + early if (nonOrder.test(text)) continue;)
what is wrong: Any message containing ? or words such as maganda/ganda/malambot/thank/salamat/magkano/hm/available/meron/cancel/palit/change/swap is discarded entirely (neither captured nor placed in unclear). This silently loses real 1st-capture orders that happen to include appreciation, a question mark, or similar Taglish. B6 requires a match on MINE+code, code-only, or code+size/colour (not an exact match); pure appreciation/question is a Job 2 "change nothing" case, not a reason to drop a first mention that also contains an order form.
concrete example: Host has called T7 (sizes 2XL/3XL, colours Black/Red). Message text "mine T7 3XL maganda po" (or "mine T7?", "T7 red?").
wrong output: { captures: [], unclear: [] } — order lost, never reviewed.
the fix: Do not early-exit on nonOrder. Either (a) run the order-matching logic first and only suppress when the message has no mine/code/size/colour match, or (b) strip the non-order tokens before the test and only skip pure non-order messages. Keep the tokens for later Job 2 classification.

severity: High
file and line: server/liveEngine/job1.ts ~lines 70–75 (the if (!hasMine && remainder) continue; inside the for (const event of selected) loop)
what is wrong: A code-only or code+size/colour message that contains any extra word (after stripping polite particles, digits, sizes, colours and the extra-qty pattern) is dropped when it lacks the word "mine". B6 explicitly lists "code only" and "code + size or colour" as valid matches and states they need not be exact. Extra polite or descriptive words therefore lose the order instead of producing a capture (and they are not sent to unclear because selected.length > 0).
concrete example: Host has called T7. Message text "T7 3XL red po now" or "T7 3XL hurry".
wrong output: { captures: [], unclear: [] } — order lost.
the fix: Remove the !hasMine && remainder guard (or make it far more permissive). Capture whenever a known code is present and the size/colour (if any) can be extracted; leave residual text for Job 2. Only refuse when the message is clearly non-order after the code/size/colour have been accounted for.

severity: Medium
file and line: server/liveEngine/job1.ts line 38 (if (!current) continue;)
what is wrong: Every message that arrives before the first host call is silently discarded (not captured, not placed in unclear). Even a message that names a code the host later calls is never re-examined. B5/B6 allow ordering of codes that have been (or will be) called; a pre-first-call "mine CODE" or bare CODE should at least be retained as unclear evidence so it can be clarified or reviewed, not dropped.
concrete example: No events yet. Message at t=–1: "mine T7 3XL". Host later calls T7 at t=0. No subsequent clarifying message from the same buyer.
wrong output: message ignored; final { captures: [], unclear: [] } even after T7 exists.
the fix: When !current, still run the mine/extra/code-presence checks. If the message contains mine, an extra-qty pattern, or a token that looks like a code, push it to unclear (reason missing_code or pre_call). Optionally, after all events are known, a second pass can promote any pre-call unclear entries whose code later appears.

severity: Medium
file and line: server/liveEngine/job1.ts extra-qty handling (~lines 16–21, 52–55, 78–80) and the kind: qty ? 'extra' : 'first' assignment
what is wrong: A first-ever mention that itself contains "+1", "one more", "T7 2", etc. is recorded as kind: 'extra' with the numeric value taken as the quantity. The owner's wording ("additional pieces", "another order") is ambiguous for a message that is also the 1st capture; the implementation may under-count (treating "mine T7 +1" as qty 1 instead of an implied base + 1) or mis-label the capture.
concrete example: First message from buyer: "mine T7 +1".
wrong output: single capture { qty: 1, kind: 'extra' } (total pieces = 1).
the fix: When there is no prior capture for that buyer+code, treat a suffix number or "+N" as the total quantity of the first capture (kind: 'first', qty = N). Reserve the "additional" interpretation for messages that arrive after a first capture already exists. Document the chosen rule.

severity: Low
file and line: src/utils/invoiceArtwork.ts (hard-coded strings in renderBranded and invoiceBlocks: shop name "Bangkok Plus Size OOTD", tagline "Since 2021 | Bangkok to Philippines", "Payment window / 24 hours", QR slot labels, footer text, colours, dimensions)
what is wrong: Several values that the packet flags as "anything hard-coded that should come from settings" are baked in. QRs correctly come from the caller; the rest do not.
concrete example: Caller supplies different shop branding or a non-24 h payment window via settings.
wrong output: Invoice always shows the hard-coded Bangkok Plus Size OOTD header and "24 hours".
the fix: Accept shop name, tagline, payment-window text and footer as optional fields on InvoiceArtworkInput (with the current strings as defaults) so they can be driven from settings.

severity: Low
file and line: .github/workflows/kos-check.yml (the has_kos / has_other presence test)
what is wrong: The check is only a path-presence test. Any change under kos/ (including a trivial or unrelated edit, a deletion, or a rename) lets arbitrary code changes pass. This matches the ticket's stated "simple presence rule", but it can be bypassed without a meaningful knowledge-base update.
concrete example: PR that modifies server/liveEngine/job1.ts and also touches kos/04-State/Current-State.md with a one-line whitespace change.
wrong output: workflow succeeds.
the fix: (If the owner wants stronger enforcement) require a change specifically to the ticket's Handoff Packet or to Current-State.md, or add a lightweight content check. Otherwise leave as-is and document the limitation.

Tests missing: combined order + appreciation/question-mark cases; code+size messages that contain extra words and lack "mine"; messages that arrive before the first host call (and before a specific code is called); first-mention "+1"/suffix-number quantity semantics; re-called identical codes with updated price/size metadata.

3. What you tried to break and could not
- T1 vs T12 / T70 / AT7 / T7X boundary matching (look-arounds hold).
- Repeated "mine T7" with no extra quantity stays a single capture (B9).
- Pure "+1" / "two more" when the buyer has exactly one prior code is assigned to that code; multiple prior codes become ambiguous_extra and stay in unclear.
- Unclear "mine 3XL red" is correctly clarified by a later same-buyer "T7" (even across Messenger) and inherits size/colour; never-clarified mines remain in unclear.
- Messages containing only question/appreciation/cancel/palit tokens produce no capture.
- Duplicate delivery IDs are ignored.
- Host-supplied single size/colour is used as default; chat cannot invent size/colour/price.
- Segments are half-open, sorted, reject invalid timestamps/duplicate seqs/end-before-start.
- Invoice grouping collapses identical code+size+colour+unitPrice, integer-cent arithmetic rejects bad money/qty, live vs pre-order titles differ, pagination and "Page x of y" work, QR slots come only from the caller.

4. Questions for the owner
- Should a comment that contains a valid order form (MINE+code, code, or code+size/colour) still be a 1st capture when it also contains "maganda", a question mark, or similar words?
- Are mentions of a code that arrive before the host has called that code (or before any host call) supposed to be retained as unclear evidence, or ignored until the buyer repeats the order after the call?
- When the buyer's first message is "mine T7 +1" or "mine T7 2", is the quantity 1 (or 2) the total pieces, or is "+1" always strictly additional to an implied base of 1?
