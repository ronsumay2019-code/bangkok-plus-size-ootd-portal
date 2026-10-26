# Lessons

Every mistake becomes a rule. Repeating a logged mistake is an automatic REJECT.

| ID | What went wrong | Rule added |
|---|---|---|
| L-001 | Claude started work without reading the Antigravity handoff. | Read `00-START-HERE`, the Live Selling Business and the handoff before any change (gate G0). |
| L-002 | Claude removed the Host Item Calling Controller as "leftover". | Nothing tied to the counting method is removed without an ADR approved by the owner. |
| L-003 | Claude reported an order count (639) that wasn't verified. | Every number comes with its query or source, or it is written as "unknown". |
| L-004 | A release PDF was made before production was verified. | No release document before gate G7 evidence exists. |
| L-005 | Saving a null into `portal_kv` broke every save. | Store tests must reject nulls (now enforced in `tests/portalStore.test.ts`). |
| L-006 | After Start fresh, comments were skipped (Facebook hides names; `seenCommentIds` was stale). | A missing name never drops an order; the record is saved as "Name needed". Seen-IDs are reset together with the data. |
| L-007 | **Agents took item codes from the live chat** (owner correction, 24 Oct). | **Item codes, prices, colours and sizes come from the host's Item Events only** (Business B3). |
| L-008 | The "152 = 152" was reached by hand-setting values in seed data (`271b9f2`). | A golden test must compute its result from raw comments and events. Expected values are never typed into code. |
| L-009 | **Claude's 25 Oct redesign followed the buyers:** the "Live Order Sheet" built the live's code list from the codes the admin typed for orders. The owner corrected it: follow the host. | **Item Events from the host come first** (code, price, size, colour). Orders are looked for only inside each host event. Any design whose code list comes from orders is rejected. |
| L-010 | **Claude didn't report missed milestones as they happened** (Sun 12 PM, 6 PM, 10 PM). Grok raised the deadline risk first (R-001 #7). | At every milestone time, Claude writes "met" or "missed" in the Timeline and tells the owner the same hour. A missed milestone is never folded into a later message. |
| L-011 | **PR #10 (Codex) dropped orders mixed with chatter, and passed a stale size to a later item** (found independently by Grok and Claude, R-003). | Classify order signals before the surrounding chatter. Keep ambiguous and pre-call evidence visible. Link a clarification only to an adjacent event, and record where each inherited size or colour came from. Test a first quantity separately from later additions, and a pending amount separately from zero. |
| L-012 | **Supabase confirmation prompts from Claude's tools never reach the owner** (6 timeouts, 24–26 Oct). | Claude stops retrying after the first timeout. The owner runs the SQL in the Supabase SQL editor, and Claude verifies the result read-only. |
