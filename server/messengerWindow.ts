/**
 * Meta's Messenger rule: a Page may reply freely only within 24 hours of the buyer's last message.
 * Outside it the portal does not send at all (no message tags are approved); a person replies in Meta Business Suite.
 */
export function insideMessengerWindow(messages: Array<{ sender: string; timestamp?: string }> | undefined, now = Date.now()): boolean {
  const lastBuyer = [...(messages || [])].reverse().find((m) => m.sender === 'buyer' && m.timestamp);
  if (!lastBuyer) return false;
  const at = new Date(String(lastBuyer.timestamp)).getTime();
  return Number.isFinite(at) && now - at < 24 * 3600 * 1000;
}

export const OUTSIDE_WINDOW_DETAIL =
  "Not sent: it has been more than 24 hours since this buyer's last message, so Meta's rules don't allow the portal to send. Reply from Meta Business Suite inbox instead.";
