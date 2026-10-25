# Screens (owner-approved direction, 25 Oct 2026)

The pictures below are **samples with made-up data**, showing layout only.

## 1. Live Session
- Clean before a live.
- Appears by itself when the live starts; closes and clears by itself when it ends (B21).
- No one uses the portal during the live (B17).

## 2. Replay
- Each past live: the video, the transcript, the host's item calls on a timeline (tap one to jump), the orders found in each event, and each item's story (B20).

## 3. Orders review: all buyers of one live
![[orders-review-sample.png]]
- **Grouped by buyer,** 20 per page, with search.
- **Counts at the top:** pieces, buyers, confirmed, changed, need a look.
- **Store match box:** our total next to the store owner's total (S8).
- **Filters:** Need a look / Changed / Ready to invoice / Invoiced.
- **Buyer actions:** "Generate invoice" per buyer; "Resolve first" when something is unclear. Sold-out pieces show "not billed".

## 4. One buyer: order lines plus evidence
![[buyer-evidence-sample.png]]
- **Left:** the order lines, exactly what goes on the invoice, tagged OK / Changed / Swap / +1 / Sold out.
- **Right:** everything the buyer said in the live chat and Messenger, in time order, each with its replay frame and the host's or Page's reply.
- Tapping a line highlights its evidence.

## 5. Evidence card (one order)
![[evidence-card-sample.png]]
- **Contents:** replay frame at the final comment's time; the final comment (chat name, text, time, link to Facebook); the host's words; the host's call for the item; the story; the final order only.
- **Internal only: never sent to buyers.**

## 6. Invoice generator: all in one screen (owner: "That's exactly what we need")
![[invoice-generator-sample.png]]
1. **Review & proof:** the invoice preview, with "proof" on every line opening the evidence card beside it. Lines can be edited by tapping them. **No reason field.** The original quietly stays in the order's story.
2. **Confirm.**
3. **Take a photo:** the phone camera photographs the order inside its plastic bag. This is the existing camera feature in `src/components/AutoReconciliationSummary.tsx` (`capture="environment"`). Retake is possible.
4. **Message:** a text field at the top for the shop's own message.
5. **Send:** the **invoice picture in the shop's template** (B27), plus the bag photo, plus the message, go to the buyer in Messenger. The owner approves before sending (shop rule).

## Invoice template
- **Renderer:** the shop's existing template, drawn by `bangkokplussizeootd/lib/invoice-artwork.ts` (old portal). It is ported into this portal, not redrawn.
- **Contents:** pink header ("Bangkok Plus Size OOTD · Since 2021 | Bangkok to Philippines"); "LIVE ORDER INVOICE"; the invoice number and status; Bill to (the chat name); live, invoice date, payment due and 24-hour window; ITEM / SIZE, QTY, UNIT PRICE, AMOUNT; subtotal, shipping, total and balance; shop-approved payment QRs (GCash / Maya / Bank from settings); payment notes; QR warning; "Page x of y".
- **Item line:** comes from the host's call (code, description, colour, size), never the buyer's comment text. The old sample showed "Teal po mine / Not specified" (L-007).
- **One line per item** (code + size + colour) with a quantity, e.g. "T7 Linen set · Black / 3XL × 100" (B28).

## Tab names and clean-up (proposed 25 Oct, waiting on owner)

The owner asked for simple names, and for features that aren't needed now to come off. The rule: **keep what works, add the approved screens, then remove only what the owner picks.** Hidden features are kept in the code so they can come back.

| Today (9 tabs) | Proposed | Why |
|---|---|---|
| Live Session Command | **Live** | Appears and clears by itself (B21) |
| Replay Review Studio | **Replay** | Review each past live (B20) |
| Order Review & Verification, Page Messenger Orders | **Orders** | The new review page with buyers, evidence and the store match. Messenger orders during a live are live orders (B7), so they belong here |
| Reconciliation & Invoices | **Invoices** | The all-in-one invoice generator |
| Payments & Shipping | **Payments & Shipping** | Unchanged |
| Pre-Orders Lane | *owner decides* | Not part of live selling |
| Sales & Demand Analytics | *hide (proposed)* | Not needed now |
| Pola AI Co-Pilot | *hide (proposed)* | Not needed now |

Other features:
- **Owner override form** (order correction that requires a reason): *replace* with tap-to-edit in the invoice generator (no reason field).
- **Strategic analysis pop-up** (AI): *hide (proposed)*.
- **Inventory / rack board:** already unreachable from the menu, and conflicts with B1. *Remove.*
- **Kept as they are:** staff sign-in links (5 seats), the owner's Facebook token form, the owner's Start fresh, and the READY / ON AIR status.
