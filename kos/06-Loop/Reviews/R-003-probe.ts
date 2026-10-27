import { job1 } from '../../../server/liveEngine/job1';
const ev = (seq:number, code:string, t:string) => ({ seq, code, price: 650, sizes:['2XL','3XL','4XL'], colours:['Black','Beige'], calledAt:`2026-10-24T06:${t}:00Z` });
const m = (id:string, t:string, name:string, text:string) => ({ id, at:`2026-10-24T06:${t}Z`, name, text, channel:'live_chat' as const });
const events=[ev(1,'T3','00'), ev(2,'T7','10'), ev(3,'T9','20')];
const cases: [string, any[]][] = [
 ['A. "mine T7 salamat" (order + thanks)', [m('a','11:00','Buyer A','mine T7 salamat po')]],
 ['B. "mine T7 ganda!" (order + appreciation)', [m('b','11:00','Buyer B','mine T7 ganda!')]],
 ['C. first order "mine T7 2" (2 pieces, first time)', [m('c','11:00','Buyer C','mine T7 2')]],
 ['D. unclear "mine 2XL" at T3, later unrelated "mine T9"', [m('d1','05:00','Buyer D','mine 2XL'), m('d2','25:00','Buyer D','mine T9')]],
 ['E. "mine T7 po?" (order typed with a question mark)', [m('e','11:00','Buyer E','mine T7 po?')]],
];
for (const [label, msgs] of cases) {
  const r = job1(events, msgs);
  console.log(label, '\n   captures:', JSON.stringify(r.captures.map(c=>({code:c.code,size:c.size,qty:c.qty,kind:c.kind,clarified:c.clarifiedMessageIds}))), '\n   unclear:', JSON.stringify(r.unclear.map(u=>u.text)));
}
