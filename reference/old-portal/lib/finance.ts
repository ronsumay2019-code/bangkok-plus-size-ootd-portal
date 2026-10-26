import { z } from "zod";
import type { Invoice, Payment } from "./types";
import { validPaymentProof } from "./payment-proof";

export const money = (n: number) => Math.sign(n) * Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100;
export const php = (n: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);
export const Money = z.number().finite().min(0).max(100_000_000).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001, "Use at most two decimal places");
export const Part = z.object({ name: z.string().trim().min(1).max(100), quantity: z.number().int().min(1).max(100), price: Money.nullable() }).strict();
export type PackagePart = z.infer<typeof Part>;
export function packagePrice(parts: PackagePart[]): number | null {
  return !parts.length || parts.some(p => p.price === null || !Money.safeParse(p.price).success || !Number.isInteger(p.quantity) || p.quantity < 1 || p.quantity > 100) ? null : money(parts.reduce((sum, p) => sum + money(p.price!) * p.quantity, 0));
}
export const InvoiceLineSchema = z.object({ code: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(200), size: z.string().trim().max(80), qty: z.number().int().min(1).max(10000), price: Money }).passthrough();
export const InvoiceCorrection = z.object({
  action: z.literal("correct"), id: z.string().min(1), revision: z.number().int().min(0), reason: z.string().trim().min(5).max(500),
  customerId: z.string().min(1), liveId: z.string().nullable(), lines: z.array(InvoiceLineSchema).min(1).max(200), shipping: Money,
  issuedAt: z.iso.datetime(), dueAt: z.iso.datetime(), status: z.enum(["active", "cancelled"]),
}).strict().refine(v => Date.parse(v.dueAt) >= Date.parse(v.issuedAt), "Payment deadline must follow the invoice date");
export const EXPENSE_TYPES = ["Pre-order", "Live", "Food", "Transportation", "Gas"] as const;
export const Expense = z.object({ id: z.string().min(1).max(80), name: z.string().trim().min(1).max(200), type: z.enum(EXPENSE_TYPES), amount: Money, receipt: z.string().max(1_450_000).default(""), receiptName: z.string().max(200).default("") }).strict();
export const DaySchema = z.object({ action: z.literal("day"), day: z.iso.date(), revision: z.number().int().min(0), capital: Money, adjustment: z.number().finite().min(-100_000_000).max(100_000_000).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001, "Use at most two decimal places"), reason: z.string().trim().min(5).max(500), expenses: z.array(Expense).max(100) }).strict().refine(v => new Set(v.expenses.map(e => e.id)).size === v.expenses.length, "Expense rows must have distinct IDs");
export type ExpenseRow = z.infer<typeof Expense>;
export type DayLedger = { day: string; revision: number; capital: number; adjustment: number; expenses: ExpenseRow[] };
export function dayLeftover(day: Pick<DayLedger, "capital" | "adjustment" | "expenses">) { return money(day.capital + day.adjustment - day.expenses.reduce((n, e) => n + e.amount, 0)); }
export function invoiceDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(value)) + " PHT";
}
export function manilaDay(value: string | number = Date.now()) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
/** Only checked receipt-backed payments belonging to this invoice and buyer count as cash. */
export function checkedInvoicePayments(inv: Invoice, payments: Payment[]): Payment[] {
  return payments.filter(p => p.invoiceId === inv.id && p.customerId === inv.customerId && p.kind === "payment" && p.proof && validPaymentProof(p.proofImage) && Money.safeParse(p.amount).success && p.amount > 0);
}
export function invoiceAmounts(inv: Invoice, payments: Payment[]) {
  const total = money(inv.subtotal + inv.shipping);
  const cash = money(checkedInvoicePayments(inv, payments).reduce((s, p) => s + p.amount, 0));
  const credited = money(cash + inv.depositCredit);
  return { total, cash, credited, remaining: Math.max(0, money(total - credited)), overpaid: Math.max(0, money(credited - total)) };
}
/** Owner decision (13 Oct 2026): the buyer pays within 24 hours of the invoice being SENT to them (the next day, same
    time), not from when it was created. The window is the invoice's dueAt − issuedAt (settings.holdHours, 24).
    `on: false` switches deadlines off entirely: no due date shown, no deadline reminders, no automatic release. */
export const paymentDeadlines = { on: true };
/** The buyer's real payment deadline (ms), Infinity while deadlines are off. The payment window (dueAt − issuedAt)
    runs from when the owner marked the invoice sent at the final gate, never ending before the printed deadline.
    Unsent: the deadline it would get if sent at `now`; without `now`, Infinity (no reminders or release before the
    buyer has the invoice). */
export function paymentDeadline(inv: Pick<Invoice, "issuedAt" | "dueAt" | "sentAt">, now?: number): number {
  if (!paymentDeadlines.on) return Infinity;
  const due = Date.parse(inv.dueAt), window = Math.max(0, due - Date.parse(inv.issuedAt));
  if (inv.sentAt) return Math.max(due, Date.parse(inv.sentAt) + window);
  return now === undefined ? Infinity : Math.max(due, now + window);
}
export const windowHours = (inv: Pick<Invoice, "issuedAt" | "dueAt">) => money((Date.parse(inv.dueAt) - Date.parse(inv.issuedAt)) / 36e5);
/** Released (expired) and cancelled invoices are not debt: their items went to the next in line. */
export const settledOrOwed = (i: Pick<Invoice, "status">) => i.status !== "cancelled" && i.status !== "expired";
/** The same buyer's other invoices that are still owed, for the "previous balances" lines (image and text alike). */
export function previousBalances(inv: Invoice, invoices: Invoice[], payments: Payment[]): { invoice: Invoice; remaining: number }[] {
  return invoices.filter(i => i.customerId === inv.customerId && i.id !== inv.id && settledOrOwed(i))
    .map(i => ({ invoice: i, remaining: invoiceAmounts(i, payments).remaining })).filter(x => x.remaining > 0);
}
export type InvoiceGroup = "sent" | "paid" | "unpaid" | "partial";
export function accounting(invoices: Invoice[], payments: Payment[]) {
  const sent = invoices.filter(i => i.sentAt && settledOrOwed(i));
  const amounts = new Map(sent.map(i => [i.id, invoiceAmounts(i, payments)]));
  const paid = sent.filter(i => amounts.get(i.id)!.remaining === 0);
  const partial = sent.filter(i => { const a = amounts.get(i.id)!; return a.remaining > 0 && a.credited > 0; });
  const unpaid = sent.filter(i => { const a = amounts.get(i.id)!; return a.remaining > 0 && a.credited <= 0; });
  const total = money(sent.reduce((n, i) => n + amounts.get(i.id)!.total, 0));
  const outstanding = money(sent.reduce((n, i) => n + amounts.get(i.id)!.remaining, 0));
  const collected = money(total - outstanding);
  return { sent, paid, partial, unpaid, total, outstanding, collected, collectiblePercent: total ? outstanding / total * 100 : 0 };
}

/** Four arithmetic operations, parentheses and decimals. No eval or executable expressions. */
export function calculate(input: string): number {
  if (/[\d.]\s+[\d.]/.test(input)) throw new Error("Separate numbers with an arithmetic operator.");
  const raw = input.replace(/\s/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  if (!raw || raw.length > 200 || /[^\d.+*/()\-]/.test(raw)) throw new Error("Use numbers, +, −, ×, ÷ and parentheses.");
  const tokens = raw.match(/\d*\.\d+|\d+|[()+*/-]/g) || [];
  if (tokens.join("") !== raw) throw new Error("Check the calculation.");
  let pos = 0;
  function atom(): number {
    const t = tokens[pos++];
    if (t === "+") return atom(); if (t === "-") return -atom();
    if (t === "(") { const v = expression(); if (tokens[pos++] !== ")") throw new Error("Close the parentheses."); return v; }
    if (!t || !/^(\d|\.)/.test(t)) throw new Error("Enter a number."); return Number(t);
  }
  function product(): number { let v = atom(); while (["*", "/"].includes(tokens[pos])) { const op = tokens[pos++], next = atom(); if (op === "/" && next === 0) throw new Error("Cannot divide by zero."); v = op === "*" ? v * next : v / next; } return v; }
  function expression(): number { let v = product(); while (["+", "-"].includes(tokens[pos])) { const op = tokens[pos++], next = product(); v = op === "+" ? v + next : v - next; } return v; }
  const n = expression(); if (pos !== tokens.length || !Number.isFinite(n) || Math.abs(n) > 100_000_000) throw new Error("Check the calculation or amount."); return money(n);
}
