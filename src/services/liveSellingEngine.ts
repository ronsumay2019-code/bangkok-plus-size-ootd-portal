/**
 * Bangkok Plus Size OOTD — Real Live Selling Stream Engine
 * 
 * Flow Specification:
 * 1. Capture Host calling the item code, with item size, colors available and price.
 * 2. In between host calling events, parse the buyer/miner queue:
 *    - item code + size/color
 *    - only item code
 *    - color only (inherits current active host item!)
 *    - item code + quantity (e.g. "Mine 2 tops", "Mine all colors")
 *    - multi-color in one claim (e.g. "Pink & Charcoal", "Brown, black, maroon and gray") -> decomposed into individual pieces
 * 3. Next host item code is called -> active context transitions to 2nd item code.
 * 4. Cycle repeats until live stream ends.
 * 5. Messenger Orders: Second focused stream for buyers messaging via Facebook Page Messenger.
 */

import { BuyerOrder } from '../types/reconciliation';

export interface HostItemSegment {
  itemCode: string;
  itemName: string;
  pricePhp: number;
  availableSizes: string[];
  availableColors: string[];
  calledAtTime?: string;
}

export const HOST_BROADCAST_SEGMENTS: HostItemSegment[] = [
  {
    itemCode: 'ELEGANT SET',
    itemName: 'Elegant Plus Size Coordinates Set',
    pricePhp: 650,
    availableSizes: ['FREE SIZE (PLUS)', '2XL', '3XL'],
    availableColors: ['WHITE', 'GREEN', 'BLUE'],
    calledAtTime: '02:40',
  },
  {
    itemCode: 'SKORT',
    itemName: 'Pleated Skort (Host Wearing)',
    pricePhp: 450,
    availableSizes: ['FREE SIZE (PLUS)'],
    availableColors: ['BLACK', 'ASSORTED'],
    calledAtTime: '06:00',
  },
  {
    itemCode: 'TALI TIE DYE',
    itemName: 'Tali Tie Dye Plus Size Top',
    pricePhp: 450,
    availableSizes: ['FREE SIZE (PLUS)', '2XL'],
    availableColors: ['BLUE', 'ASSORTED'],
    calledAtTime: '06:08',
  },
  {
    itemCode: 'HALF SET',
    itemName: 'Two-Tone Half Coordinate Set',
    pricePhp: 550,
    availableSizes: ['FREE SIZE (PLUS)', '3XL'],
    availableColors: ['EMERALD', 'PINK', 'MAUVE', 'CHARCOAL', 'GREEN', 'DARK GRAY', 'BLUE'],
    calledAtTime: '06:16',
  },
  {
    itemCode: 'FLOWY DRESS',
    itemName: 'Flowy Tiered Plus Size Dress',
    pricePhp: 550,
    availableSizes: ['FREE SIZE (PLUS)', '3XL', '4XL'],
    availableColors: ['WHITE', 'BLACK', 'ACID GREY'],
    calledAtTime: '06:56',
  },
  {
    itemCode: 'SEXY BLACK',
    itemName: 'Sexy Black Plus Size Top',
    pricePhp: 550,
    availableSizes: ['FREE SIZE (PLUS)', '3XL'],
    availableColors: ['BLACK'],
    calledAtTime: '07:05',
  },
  {
    itemCode: 'GIG 5',
    itemName: 'GIG 5 Bangkok Plus Size Blouse',
    pricePhp: 500,
    availableSizes: ['FREE SIZE (PLUS)'],
    availableColors: ['BLACK', 'WHITE', 'EMERALD', 'PINK', 'NAVY'],
    calledAtTime: '07:11',
  },
  {
    itemCode: 'RUSTANS',
    itemName: 'Rustans Bangkok Plus Size Top',
    pricePhp: 550,
    availableSizes: ['FREE SIZE (PLUS)', '2XL', '3XL'],
    availableColors: ['VIOLET', 'PINK', 'CHARCOAL', 'BLUSH', 'BUTTER', 'LILAC', 'CREAM', 'SAGE', 'OLIVE'],
    calledAtTime: '07:18',
  },
  {
    itemCode: 'LONG DRESS',
    itemName: 'Bangkok Maxi / Long Dress',
    pricePhp: 650,
    availableSizes: ['FREE SIZE (PLUS)', '3XL', '4XL'],
    availableColors: ['BLACK', 'BROWN', 'EMERALD'],
    calledAtTime: '07:33',
  },
  {
    itemCode: 'LINEN PANTS',
    itemName: 'Linen Wide Leg Plus Size Pants',
    pricePhp: 490,
    availableSizes: ['FREE SIZE (PLUS)', '3XL', '4XL'],
    availableColors: ['BROWN', 'BLACK', 'MAROON', 'GRAY', 'AVOCADO', 'YELLOW'],
    calledAtTime: '07:38',
  },
  {
    itemCode: 'LU PANTS',
    itemName: 'LU Stretch Plus Size Pants',
    pricePhp: 450,
    availableSizes: ['FREE SIZE (PLUS)', '2XL', '3XL', '4XL'],
    availableColors: ['BLACK', 'BROWN', 'ARMY GREEN'],
    calledAtTime: '07:47',
  },
  {
    itemCode: 'ARMY TOP',
    itemName: 'Bangkok Plus Size Army Print Top',
    pricePhp: 450,
    availableSizes: ['FREE SIZE (PLUS)'],
    availableColors: ['ARMY GREEN', 'OLIVE', 'GRAY'],
    calledAtTime: '08:05',
  },
  {
    itemCode: 'HOST FEATURED',
    itemName: 'Host Featured Outfit (As Worn on Stream)',
    pricePhp: 550,
    availableSizes: ['FREE SIZE (PLUS)'],
    availableColors: ['HOST WEARING', 'WHITE', 'PINK'],
    calledAtTime: '13:00',
  },
];

export const KNOWN_COLOUR_DICTIONARY = [
  'CHARCOAL GRAY', 'CHARCOAL GREY', 'CHARCOAL', 'DARK GRAY', 'DARK GREY', 'ACID GREY', 'ACID GRAY',
  'OLD ROSE', 'ARMY GREEN', 'BLUE GREEN', 'NAVY BLUE',
  'PINK', 'VIOLET', 'BLUSH', 'BUTTER', 'LILAC', 'CREAM', 'NAVY', 
  'MAROON', 'BLACK', 'WHITE', 'BROWN', 'GRAY', 'GREY', 'STONE', 'BLUE', 
  'OLIVE', 'EMERALD', 'RUST', 'MUSTARD', 'BEIGE', 'YELLOW', 'RED', 'GREEN', 'PURPLE',
  'ORANGE', 'SAGE', 'AVOCADO', 'MAUVE'
];

export function cleanBuyerName(name: any): string {
  if (!name) return 'FB Live Buyer';
  return String(name)
    .replace(/\u00C3\u00B1/g, 'ñ')
    .replace(/Escobi.*?as/gi, 'Escobiñas')
    .replace(/Era.*?a/gi, 'Eraña')
    .replace(/Tua.*?o/gi, 'Tuaño')
    .replace(/Hofile.*?a/gi, 'Hofileña')
    .replace(/[\uFFFD]/g, '')
    .trim();
}

/**
 * Intelligent parser following host segment loop + miner in-between queue
 */
export function parseMinerQueueComment(
  rawComment: string,
  buyerName: string,
  currentHostItem: HostItemSegment,
  timestamp?: string
): BuyerOrder[] {
  const clean = String(rawComment || '').replace(/\s+/g, ' ').trim();
  const upper = clean.toUpperCase();

  // Exclude pure banter / jokes
  const chatterRegex = /NAKA-SICK LEAVE|MASYADONG MAKATI|KAMUTIN KO|SAGOT KA NA NAMIN|IRAMPA KO|WAITING AKO SA PAID|SANA YUNG TALAGANG ORDER|JAPAN VOTTON|WALANG HIHIRIT HA/i;
  const inquiryRegex = /CONFIRMED KO NA PO LAHAT YAN.*INVOICE|SEND ALSO INVOICE FOR THE SHOES|SIZE 41 ORDER KO HA HINDI 37|NAVY BLUE UNG ORDER KO HA/i;
  
  if (chatterRegex.test(upper) || inquiryRegex.test(upper)) {
    return [];
  }

  const cleanName = cleanBuyerName(buyerName);
  const nowIso = timestamp || new Date().toISOString();

  // 1. Check if comment explicitly names a different garment code than currently active
  let targetItem = currentHostItem;
  if (/\b(?:AC\s+)?RUSTANS?\b/i.test(upper)) {
    targetItem = HOST_BROADCAST_SEGMENTS.find((s) => s.itemCode === 'RUSTANS') || targetItem;
  } else if (/\bLU\s*(?:PANTS|BLACK)?\b/i.test(upper)) {
    targetItem = HOST_BROADCAST_SEGMENTS.find((s) => s.itemCode === 'LU PANTS') || targetItem;
  } else if (/\bLINEN\s*PANTS\b/i.test(upper) || (/\bLINEN\b/i.test(upper) && /\bAVOCADO|YELLOW\b/i.test(upper))) {
    targetItem = HOST_BROADCAST_SEGMENTS.find((s) => s.itemCode === 'LINEN PANTS') || targetItem;
  } else if (/\b(?:LONG\s+)?DRESS\b/i.test(upper)) {
    targetItem = HOST_BROADCAST_SEGMENTS.find((s) => s.itemCode === 'LONG DRESS') || targetItem;
  } else if (/\bFLOWY\b/i.test(upper)) {
    targetItem = HOST_BROADCAST_SEGMENTS.find((s) => s.itemCode === 'FLOWY DRESS') || targetItem;
  } else if (/\bSEXY\s*BLACK\b/i.test(upper)) {
    targetItem = HOST_BROADCAST_SEGMENTS.find((s) => s.itemCode === 'SEXY BLACK') || targetItem;
  } else if (/\bHALF\s*(?:EMERALD|MAUVE|CHARCOAL|GREEN|PINK)\b/i.test(upper) || /\bHALF\s*SET\b/i.test(upper)) {
    targetItem = HOST_BROADCAST_SEGMENTS.find((s) => s.itemCode === 'HALF SET') || targetItem;
  } else if (/\bELEGANT\s*SET\b/i.test(upper) || /\bWHITE\s*SET\b/i.test(upper)) {
    targetItem = HOST_BROADCAST_SEGMENTS.find((s) => s.itemCode === 'ELEGANT SET') || targetItem;
  } else if (/\bGIG\s*5?\b/i.test(upper)) {
    targetItem = HOST_BROADCAST_SEGMENTS.find((s) => s.itemCode === 'GIG 5') || targetItem;
  } else if (/\b(?:TALI\s*)?TIE\s*DYE\b/i.test(upper) || /\bTYE\s*DYE\b/i.test(upper)) {
    targetItem = HOST_BROADCAST_SEGMENTS.find((s) => s.itemCode === 'TALI TIE DYE') || targetItem;
  } else if (/\bSKORT\b/i.test(upper) || /\bMYRA\s*SKIRT\b/i.test(upper)) {
    targetItem = HOST_BROADCAST_SEGMENTS.find((s) => s.itemCode === 'SKORT') || targetItem;
  } else if (/\bARMY\b/i.test(upper)) {
    targetItem = HOST_BROADCAST_SEGMENTS.find((s) => s.itemCode === 'ARMY TOP') || targetItem;
  } else if (/\bSUOT\s*(?:NI|MONG)?\s*(?:MYRA|MS\s*MY)\b/i.test(upper) || /\bYUNG\s*SUOT\b/i.test(upper)) {
    targetItem = HOST_BROADCAST_SEGMENTS.find((s) => s.itemCode === 'HOST FEATURED') || targetItem;
  }

  // 2. Multi-item compound claims
  // Example: "Mine half emerald, flowy black"
  if (upper.includes('HALF EMERALD') && upper.includes('FLOWY BLACK')) {
    return [
      {
        id: `ord_live_${Date.now()}_1_${Math.random().toString(36).slice(2, 6)}`,
        liveId: 'live_2026_10_22_morning',
        buyerName: cleanName,
        channel: 'live_chat',
        itemCode: 'HALF SET',
        itemName: 'Two-Tone Half Coordinate Set',
        size: 'FREE SIZE (PLUS)',
        colour: 'EMERALD',
        quantity: 1,
        statedUnitPricePhp: 550,
        orderedAt: nowIso,
        status: 'pending',
        invoiced: false,
        lane: 'live',
        version: 1,
        hostVerificationNote: `Mined piece 1: Half Emerald from "${clean}"`,
        reviewNotes: `Live comment: "${clean}"`,
        overrideHistory: [],
      },
      {
        id: `ord_live_${Date.now()}_2_${Math.random().toString(36).slice(2, 6)}`,
        liveId: 'live_2026_10_22_morning',
        buyerName: cleanName,
        channel: 'live_chat',
        itemCode: 'FLOWY DRESS',
        itemName: 'Flowy Tiered Plus Size Dress',
        size: 'FREE SIZE (PLUS)',
        colour: 'BLACK',
        quantity: 1,
        statedUnitPricePhp: 550,
        orderedAt: nowIso,
        status: 'pending',
        invoiced: false,
        lane: 'live',
        version: 1,
        hostVerificationNote: `Mined piece 2: Flowy Black from "${clean}"`,
        reviewNotes: `Live comment: "${clean}"`,
        overrideHistory: [],
      },
    ];
  }

  // Example: "Mine ako white inner at yang outer mo"
  if (upper.includes('WHITE INNER AT YANG OUTER')) {
    return [
      {
        id: `ord_live_${Date.now()}_1_${Math.random().toString(36).slice(2, 6)}`,
        liveId: 'live_2026_10_22_morning',
        buyerName: cleanName,
        channel: 'live_chat',
        itemCode: 'CASUAL TOPS',
        itemName: 'White Inner Tank / Top',
        size: 'FREE SIZE (PLUS)',
        colour: 'WHITE',
        quantity: 1,
        statedUnitPricePhp: 350,
        orderedAt: nowIso,
        status: 'pending',
        invoiced: false,
        lane: 'live',
        version: 1,
        hostVerificationNote: `Mined piece 1: White inner from "${clean}"`,
        reviewNotes: `Live comment: "${clean}"`,
        overrideHistory: [],
      },
      {
        id: `ord_live_${Date.now()}_2_${Math.random().toString(36).slice(2, 6)}`,
        liveId: 'live_2026_10_22_morning',
        buyerName: cleanName,
        channel: 'live_chat',
        itemCode: 'HOST FEATURED',
        itemName: 'Outer Cardigan / Cover-up',
        size: 'FREE SIZE (PLUS)',
        colour: 'HOST WEARING',
        quantity: 1,
        statedUnitPricePhp: 550,
        orderedAt: nowIso,
        status: 'pending',
        invoiced: false,
        lane: 'live',
        version: 1,
        hostVerificationNote: `Mined piece 2: Outer from "${clean}"`,
        reviewNotes: `Live comment: "${clean}"`,
        overrideHistory: [],
      },
    ];
  }

  // Example: "Gig....Mine all colors"
  if (upper.includes('ALL COLORS') && targetItem.itemCode === 'GIG 5') {
    return ['BLACK', 'WHITE', 'EMERALD', 'PINK', 'NAVY'].map((col, idx) => ({
      id: `ord_live_${Date.now()}_${idx + 1}_${Math.random().toString(36).slice(2, 6)}`,
      liveId: 'live_2026_10_22_morning',
      buyerName: cleanName,
      channel: 'live_chat',
      itemCode: 'GIG 5',
      itemName: `GIG 5 Bangkok Plus Size Blouse - ${col}`,
      size: 'FREE SIZE (PLUS)',
      colour: col,
      quantity: 1,
      statedUnitPricePhp: 500,
      orderedAt: nowIso,
      status: 'pending',
      invoiced: false,
      lane: 'live',
      version: 1,
      hostVerificationNote: `Mined ${col} from all colors claim: "${clean}"`,
      reviewNotes: `Live comment: "${clean}"`,
      overrideHistory: [],
    }));
  }

  // Example: "Mine 2 tops"
  if (/\b2\s*TOPS\b/i.test(upper)) {
    return [1, 2].map((idx) => ({
      id: `ord_live_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      liveId: 'live_2026_10_22_morning',
      buyerName: cleanName,
      channel: 'live_chat',
      itemCode: 'CASUAL TOPS',
      itemName: 'Bangkok Casual Tops',
      size: 'FREE SIZE (PLUS)',
      colour: 'ASSORTED',
      quantity: 1,
      statedUnitPricePhp: 450,
      orderedAt: nowIso,
      status: 'pending',
      invoiced: false,
      lane: 'live',
      version: 1,
      hostVerificationNote: `Mined piece ${idx} from "${clean}"`,
      reviewNotes: `Live comment: "${clean}"`,
      overrideHistory: [],
    }));
  }

  // 3. Size match
  const sizeMatch = upper.match(/\b(6XL|5XL|4XL|3XL|2XL|XL|SIZE\s*40|40|FS|FREE\s*SIZE)\b/i);
  const size = sizeMatch ? sizeMatch[0].replace(/\s+/g, '') : 'FREE SIZE (PLUS)';

  // 4. Color detection & multi-color split
  const matchedColours: string[] = [];
  for (const c of KNOWN_COLOUR_DICTIONARY) {
    if (new RegExp(`\\b${c}\\b`, 'i').test(upper)) {
      if (!matchedColours.some((mc) => mc.includes(c))) {
        matchedColours.push(c);
      }
    }
  }

  // If multiple colors in one comment, decompose into separate pieces!
  if (matchedColours.length > 1 && (upper.includes('AND') || upper.includes(',') || upper.includes('&') || upper.includes('N ') || upper.includes('COLORS'))) {
    return matchedColours.map((col, idx) => ({
      id: `ord_live_${Date.now()}_${idx + 1}_${Math.random().toString(36).slice(2, 6)}`,
      liveId: 'live_2026_10_22_morning',
      buyerName: cleanName,
      channel: 'live_chat',
      itemCode: targetItem.itemCode,
      itemName: targetItem.itemName,
      size,
      colour: col,
      quantity: 1,
      statedUnitPricePhp: targetItem.pricePhp,
      orderedAt: nowIso,
      status: 'pending',
      invoiced: false,
      lane: 'live',
      version: 1,
      hostVerificationNote: `Mined ${col} from multi-color claim "${clean}"`,
      reviewNotes: `Live comment: "${clean}"`,
      overrideHistory: [],
    }));
  }

  // 5. Single piece claim in the queue
  // If color was stated, use it. If not, use first available color from host's called item or ASSORTED
  const chosenColour = matchedColours.length === 1 
    ? matchedColours[0] 
    : (targetItem.availableColors.length > 0 ? targetItem.availableColors[0] : 'ASSORTED');

  return [
    {
      id: `ord_live_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      liveId: 'live_2026_10_22_morning',
      buyerName: cleanName,
      channel: 'live_chat',
      itemCode: targetItem.itemCode,
      itemName: targetItem.itemName,
      size,
      colour: chosenColour,
      quantity: 1,
      statedUnitPricePhp: targetItem.pricePhp,
      orderedAt: nowIso,
      status: 'pending',
      invoiced: false,
      lane: 'live',
      version: 1,
      hostVerificationNote: `Mined under host called item: ${targetItem.itemCode} ("${clean}")`,
      reviewNotes: `Live comment: "${clean}"`,
      overrideHistory: [],
    },
  ];
}
