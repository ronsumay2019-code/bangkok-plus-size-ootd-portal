// Repairs text garbled by double UTF-8 encoding (e.g. "EscobiÃ±as" → "Escobiñas", "âš ï¸" → "⚠️")
// without touching text that is already correct (e.g. "Vera Santos", "Joy Tuazon").

const MOJIBAKE_HINT = /[ÃÂâð]/;

// Windows-1252 characters for bytes 0x80–0x9F (how most garbled text was decoded)
const CP1252: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89,
  'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95,
  '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
};

export function fixMojibake(value: string): string {
  if (!value || !MOJIBAKE_HINT.test(value)) return value;
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    const code = ch.charCodeAt(0);
    const byte = code <= 0xff ? code : CP1252[ch];
    if (byte === undefined) return value; // not a mis-decoded UTF-8 string
    bytes[i] = byte;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return value.replace(/Ã±/g, 'ñ').replace(/Ã‘/g, 'Ñ');
  }
}

// Known surnames where the ñ was lost entirely (shows as "?" or the replacement character).
// Only a single non-letter character in the ñ position is repaired.
const LOST_ENYE: Array<[RegExp, string]> = [
  [/\bEscobi[?�]as\b/gi, 'Escobiñas'],
  [/\bEra[?�]a\b/gi, 'Eraña'],
  [/\bTua[?�]o\b/gi, 'Tuaño'],
  [/\bHofile[?�]a\b/gi, 'Hofileña'],
];

export function cleanBuyerName(name: unknown): string {
  if (!name) return 'Customer';
  let out = fixMojibake(String(name));
  for (const [pattern, fixed] of LOST_ENYE) out = out.replace(pattern, fixed);
  return out.replace(/�/g, '').replace(/\s+/g, ' ').trim() || 'Customer';
}
