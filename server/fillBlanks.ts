const blank = (v: unknown) => v === undefined || v === null || v === '';

/** A record read again later (Graph hides names, KI-009) only fills fields that are still empty; nothing kept is blanked (R-004 #3). */
export function fillBlanks<T extends object>(kept: T | undefined | null, next: T): T {
  if (!kept) return next;
  const out: any = { ...kept };
  for (const [k, v] of Object.entries(next)) if (!blank(v) && blank(out[k])) out[k] = v;
  return out;
}
