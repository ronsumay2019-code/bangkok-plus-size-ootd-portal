import type {ShopState, Live} from './types';
/** Classification uses event time, never processing time or catalogue category. Exception: a comment on a live's
    own Facebook video (liveForComment). */
export function liveAt(state: Pick<ShopState,'lives'>, at: string): Live | null {
  const time=Date.parse(at);
  if(!Number.isFinite(time)) throw new Error('Original order time is required.');
  return [...state.lives].filter(l=>l.status!=='planned' && l.startedAt && time>=Date.parse(l.startedAt) && (l.endedAt ? time<Date.parse(l.endedAt) : l.status==='live')).sort((a,b)=>Date.parse(b.startedAt!)-Date.parse(a.startedAt!))[0]??null;
}
/** The Facebook video a comment was written on: the webhook's post ID is "<pageId>_<videoId>", the import's is the
    video ID, and a video's comment IDs start with "<videoId>_". */
export function videoOf(c:{postId?:string|null;commentId?:string|null}):string|null {
  const post=(c.postId??'').split('_').filter(Boolean).pop();
  return post || (c.commentId?.includes('_') ? c.commentId.split('_')[0] : null) || null;
}
/** Owner rule (2026-10-14): every order in a live's own comments is a live order, never a pre-order, even before the
    portal start or after its end. Other comments go by time (liveAt). */
export function liveForComment(state: Pick<ShopState,'lives'>, c:{postId?:string|null;commentId?:string|null;createdAt:string}): Live | null {
  const video=videoOf(c);
  return (video && state.lives.find(l=>l.fbVideoId===video)) || liveAt(state,c.createdAt);
}

/** Facebook's live_status on a video that was broadcast live: on air, or its replay now. Regular videos and reels have
    none (checked on the Page, 2026-10-15). */
export const LIVE_STATUSES=new Set(['LIVE','LIVE_STOPPED','VOD','PROCESSING']);
/** What Facebook says about the video a comment was written on (lib/server/fb-comments.ts videoFacts). */
export interface VideoFacts { live:boolean; onAir:boolean; title:string|null; startedAt:string|null; endedAt:string|null; kind?:PostKind }
/** Where a comment was written: a live (on air or replay), a reel or other video, or a photo/text post. */
export type PostKind='live'|'video'|'post';
/** The Pre-order tag (owner, 2026-10-15): Messenger, Reel (reels and other videos) or Post. */
export function preOrderTag(commentId:string|null|undefined, kind?:PostKind|null):'Messenger'|'Reel'|'Post'|null {
  if(commentId?.startsWith('mid:')) return 'Messenger';
  return kind==='video'?'Reel':kind==='post'?'Post':null;
}

const day=(iso:string)=>new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'}).format(new Date(iso));

/** Owner rule (2026-10-15): an order in a Facebook live's comments is a Live Order, written during the broadcast or on
    its replay; Messenger and other posts are Pre-orders. A live video that no portal live is linked to (nobody pressed
    "Start a new live") gets one: the portal live running at that time if it has no video yet, else a new live named
    after the video. Earlier orders from that video that are not invoiced move into it. */
export function adoptLiveVideo(state:ShopState, videoId:string, facts:VideoFacts, at:string, newId:string):{state:ShopState;live:Live} {
  const running=liveAt(state,at);
  const startedAt=facts.startedAt??at;
  const live:Live=running&&!running.fbVideoId ? {...running,fbVideoId:videoId} : {
    id:newId, title:facts.title||`Facebook live ${day(startedAt)}`, status:facts.onAir?'live':'ended', startedAt,
    endedAt:facts.onAir?null:facts.endedAt??at, fbVideoId:videoId, payday:false, lineup:[], onCamera:0 };
  const lives=state.lives.some(l=>l.id===live.id)?state.lives.map(l=>l.id===live.id?live:l):[...state.lives,live];
  const claims=state.claims.map(c=>!c.liveId&&!c.invoiceId&&videoOf({commentId:c.commentId})===videoId?{...c,liveId:live.id}:c);
  return {state:{...state,lives,claims},live};
}

type LiveName=Pick<Live,'id'|'title'|'startedAt'>;
/** A live's title and Manila date, "HAND PAINTED BATIK · Oct 15, 2026" ('' when unknown). */
export function liveLabel(liveId:string|null, lives:LiveName[]=[]) {
  const l=liveId?lives.find(x=>x.id===liveId):undefined;
  const title=l?.title?.trim()||null, date=l?.startedAt?day(l.startedAt):null;
  // "Untitled live Oct 15, 2026" already carries its date: not twice.
  return [title,date&&title?.includes(date)?null:date].filter(Boolean).join(' · ');
}
/** Owner (2026-10-15): one invoice per live, named by the live's title and date; anything else is a Pre-order Invoice.
    "Live Order Invoice · HAND PAINTED BATIK · Oct 15, 2026". kind: "Live Order" / "Pre-order" without "Invoice". */
export function invoiceLane(liveId:string|null, lives:LiveName[]=[], kind=false) {
  const base=liveId?(kind?'Live Order':'Live Order Invoice'):(kind?'Pre-order':'Pre-order Invoice');
  return [base,liveLabel(liveId,lives)].filter(Boolean).join(' · ');
}
