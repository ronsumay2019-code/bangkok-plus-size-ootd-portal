# The Story: from problem to gold solution

Status: **not yet gold.** Gold means three things: golden tests pass on real data, the acceptance rule passes (≥95% overall, 100% critical), and the owner says GO.

This story is added to at every gate. It is never rewritten to look better.

## Chapter 1: The business and the problem

Bangkok Plus Size OOTD sells Bangkok fashion in XL to 5XL to buyers in the Philippines, through Facebook lives.

- **No catalogue.** Before each live the team picks a store and gathers clothes. Stock is mostly unknown until store staff check it.
- **The host gives each item its code, price, colours and sizes on the live itself.** Every live is different.
- **Buyers claim items in the comments**: "mine", "mine T1", "T1", "T1 2XL". They often change their minds later: a different size, another piece, a swap.

The hard part: **a comment like "mine" carries no item.** Its meaning depends on which item the host had just called. The host's words aren't in anything Facebook lets the portal read. See [[Live-Selling-Business]].

## Chapter 2: Every attempt, in order

### Antigravity, 21–23 Oct
- Built the portal: React with an Express backend on Vercel, Meta Graph API v22.0, and a Messenger inbox.
- **283fd52:** added a "Host Item Calling Controller". It cycled through **fixed** segments (`HOST_BROADCAST_SEGMENTS`) rather than taking the host's calls during the live.
- **271b9f2 / f5e0702:** reported "152 = 152" against the store purchase. The 152 was set by hand in seed data (`totalMined: 152`, edited `purchased`), with orders loaded from a prepared snapshot file. It was not computed from comments. *(Why it looked right: the totals matched. Why it wasn't proof: the match was typed in.)*
- Data lived in the browser and in `/tmp`, so it disappeared between servers.

### Claude, 24 Oct
- **PRs #1–#6, merged:**
  - moved the data into a real database (Supabase);
  - Messenger send from inside the portal (verified: Facebook returned message IDs);
  - staff sign-in with 5 seats;
  - a filter for junk webhook orders (1,015+ fake ₱550 orders);
  - payments with a proof photo;
  - date filters;
  - the "Ready for the next live" screen;
  - a fix for the null save bug.
- **Mistakes** (see [[Lessons]], L-001 to L-006):
  - didn't read the handoff first;
  - removed the controller;
  - reported an unverified count of 639;
  - made a release PDF too early.
- The LINEN SHOP live, 24 Oct: its orders did not reach the portal (1 order in the database).

### The owner, 24 Oct
- Wrote down the real method: the Live Selling Business. Codes come from the host's Item Events. Orders are matched inside the window between events (Job 1), then every claim is reviewed across the chat and Messenger (Job 2).
- Correction recorded as L-007.

## Chapter 3: Root causes

*To be written after the gate G1 analysis.*

## Chapter 4: The gold solution

*Not yet.*

## Chapter 5: Proof

*Not yet.*

## Chapter 6: Launch

*Not yet.* The portal ships fresh, with 0 data.

## Chapter 7: What remains

*Not yet.*
