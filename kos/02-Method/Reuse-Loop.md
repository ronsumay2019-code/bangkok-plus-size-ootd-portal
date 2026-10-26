# Engineering Loop + Knowledge Base: document, govern, learn, reuse (HARD RULE)

Owner, 26 Oct 2026, in their words:

> "We document, we govern, we learn, and we reuse. Think of it as if you're doing a query. You always start with, let's say, I'm going to run a Facebook live selling. And then a response is going to be: is this reuse or extend or fork. And then we're going to say, we're going to reuse, because it's for the other client or other company. Because we have documented everything: we document, we govern, we learn, we self-correct, we have evidence that it's working. Every learning is documented, and every release is versioned. We will then take it as the final release, production ready, and that's what is implemented, and we will reuse it, for the same company or for other businesses. Once it is tagged as a production build ready for reuse, it's a loop already that you can set on autopilot, because we have a reference, a documentation that tells a story from one item until invoice or shipped to the buyer."

## 1. Every request starts as a query (Intake)

Before any work, the agent answers from the [[Catalogue]]:

| Answer | When | What happens |
|---|---|---|
| **Reuse** | A **production-ready** entry already does it (same or another business) | Apply it as released, with that business's settings only. No code change. |
| **Extend** | An entry does most of it; something new is needed | A new version of that entry, through gates G0–G8. |
| **Fork** | Another business needs a different variant | A new entry that starts from a released version and records what differs. |
| **New** | Nothing in the Catalogue fits | A new entry, version 0.1, status Draft. |

The answer and its reason are written in the ticket (G0).

## 2. Govern: versions and status

Every capability in the [[Catalogue]] has a version and one status:

- **Draft**: being built; nothing about it may be called "working".
- **Verified**: passed its acceptance tests at real events, with evidence links, reviewed by an agent that did not build it.
- **Production-ready**: Verified, plus the full story is documented from the first item to invoice to shipped, plus the owner approved (G6). Only this status may be reused or run on autopilot.

A status only moves up with evidence. Any failure at a real event moves it back to Draft, with the reason logged.

## 3. Evidence: what counts

- A result is stated only with how it was checked against the source (Facebook comments, the replay, the sent invoice, the shipment record).
- A count from our own database is "lines in the database", not a business result, until a sample is checked against the source (L-014).
- The aim is that the system checks itself (a match report), so nobody has to take an agent's word.

## 4. Learn and self-correct

- Every mistake becomes a lesson in [[Lessons]].
- **A lesson is closed only when it names its guard**: a test, a CI check, or a review-checklist line that catches the mistake next time. A lesson without a guard stays open. (L-003 had no guard, and the same mistake came back as L-014.)

## 5. Reuse

- A Production-ready entry carries: its version, the story (item → invoice → shipped), its settings per business, its known limits, and its evidence.
- Reuse for another business = new settings + its own first-run evidence. The entry's code does not change.
