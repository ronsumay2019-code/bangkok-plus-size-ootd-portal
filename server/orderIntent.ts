// Which live comments are orders. Follows the main system's rules (lib/order-intent.ts, owner 2026-10-18):
// "mine" in its spellings ("mine T1", "myne", "m1ne"), "pamine", mine glued to a code ("MineT4"), and short
// code-only replies ("T1", "Confirm T2", "9"). Questions, cancellations, "na mine ko" (what she already ordered),
// reactions and empty comments are not orders. Comments that name an item, colour or size without "mine"
// ("Linen pants blk", "White set sa suot mo") are kept "to check" against the replay rather than dropped.
// It never decides an item, a price or a winner.

const MINE = 'm+[iy1í]+[nñ]+e*';
const PAMINE = new RegExp(`(?:^|[^a-z])pa[\\s-]?${MINE}(?![a-z])`, 'i');
const GLUED = new RegExp(`(?:^|[^a-z])${MINE}(?=[a-z]{1,3}\\d)`, 'i');
const ONE_WORD = new RegExp(`^${MINE}[a-z]{2,12}$`, 'i');
const PAST = new RegExp(`(?:^|[^a-z])na[\\s-]?${MINE}(?![a-z])`, 'gi');
const CLAIM = new RegExp(`(?:^|[^a-z])${MINE}(?![a-z])`, 'i');
const CANCEL = /\b(?:pa[\s-]?)?(?:cancel|kansel)/i;
const SIZE = /^(?:[2-6]?x{0,4}l|xs|s|m|freesize|\d{2}(?:w|wl)?)$/i;

/** Words around a code-only reply that don't change it: "Confirm T2", "Ung 1", "D3 po". */
const FILLER = new Set([
  'po', 'ok', 'okay', 'oki', 'okie', 'sis', 'pls', 'please', 'plz', 'yes', 'yup', 'yung', 'ung', 'un', 'yong', 'na', 'lang',
  'nalang', 'nlng', 'muna', 'din', 'rin', 'ko', 'ako', 'sa', 'si', 'or', 'yata', 'and', 'at', 'sige', 'miss', 'ms', 'mam',
  'maam', 'madam', 'my', 'mai', 'confirm', 'confirmed', 'ty', 'thanks', 'salamat', 'naman', 'nga', 'pala', 'the',
]);

const clean = (raw: string) =>
  String(raw || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}️‍]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const numbered = (w: string) => /^\d{1,2}$/.test(w) && Number(w) >= 1 && Number(w) <= 30;

/** A short reply that is only item codes ("T1", "D3 po", "Confirm T2", "9"). */
function isCodeOnly(t: string): boolean {
  if (t.includes('?')) return false;
  const words = t.replace(/[,.!&+/()]/g, ' ').split(' ').filter((w) => w && !FILLER.has(w));
  if (!words.length || words.length > 4) return false;
  return words.every((w) => (/^[a-z]{1,3}\d[a-z0-9]{0,3}$/.test(w) && !SIZE.test(w) && !/^x\d+$/.test(w)) || numbered(w));
}

/** Garment words, colours and sizes buyers use when they order without "mine" */
const ITEM_WORDS =
  /\b(?:dress|set|sets|pants|pant|linen|blouse|top|tops|skirt|skort|shorts|terno|coord|co-ord|jumpsuit|romper|cardigan|polo|tee|shirt|wrap|flowy|maxi|midi|tie ?dye|white|black|blk|blck|brown|beige|cream|navy|blue|green|emerald|olive|pink|red|maroon|gray|grey|yellow|mustard|violet|lilac|lavender|orange|nude|stone|[2-6]?x{1,4}l|xl)\b/i;
/** Questions, requests to see an item, and chat that only mention an item */
const ASKING =
  /^(?:hm+|how much|magkano|mgkano|mkano|pwede|pde|meron|merun|may|anong|ano|saan|kasya|patingin|pakita|paflex|pa flex|flex|please flex|pls flex|available|avail|size)\b/i;

export interface OrderComment {
  /** For the reviewer when it isn't a plain "mine CODE" */
  note: string;
  /** Names an item without "mine": confirm on the replay before treating it as an order */
  toCheck?: boolean;
}

/** The order in a live comment, or null when the comment is not an order. */
export function orderComment(raw: string): OrderComment | null {
  const t = clean(raw);
  if (!t || CANCEL.test(t)) return null;
  const current = t.replace(PAST, ' ');
  if (CLAIM.test(current)) return { note: '' };
  if (GLUED.test(current)) return { note: 'Read as mine + code.' };
  if (PAMINE.test(current)) return { note: 'Written as "pamine".' };
  if (ONE_WORD.test(current)) return { note: 'Mine and the item written as one word.' };
  if (isCodeOnly(t)) return { note: 'Code-only reply, no "mine": check it on the replay.' };
  if (!t.includes('?') && !ASKING.test(t) && ITEM_WORDS.test(t))
    return { note: 'To check: names an item without "mine". Confirm on the replay.', toCheck: true };
  return null;
}
