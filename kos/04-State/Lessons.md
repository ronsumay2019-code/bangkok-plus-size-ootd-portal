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
