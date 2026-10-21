import {
  LiveSession,
  BuyerOrder,
  OrderAmendment,
  InventoryItem,
  PreOrder,
  MessengerThread,
} from '../types/reconciliation';

const todayDate = new Date().toISOString().slice(0, 10);
const morningStartIso = new Date(new Date().setHours(9, 0, 0, 0)).toISOString();

export const SEED_LIVE_SESSIONS: LiveSession[] = [
  {
    id: `live_${todayDate.replace(/-/g, '_')}_morning`,
    title: `Morning Live Selling Broadcast (${todayDate})`,
    status: 'ended',
    startedAt: morningStartIso,
    endedAt: new Date().toISOString(),
    fbVideoId: null,
    videoUrl: 'https://www.facebook.com/bangkokplussizeootd/live_videos',
    storeName: 'Bangkok Store Floor',
    storeDate: todayDate,
    lineup: [],
    totalComments: 0,
    totalMined: 0,
    reconciledAt: null,
    reconciliationStatus: 'unreconciled',
  },
];

export const SEED_INVENTORY_ITEMS: InventoryItem[] = [];

export const SEED_BUYER_ORDERS: BuyerOrder[] = [];

export const SEED_AMENDMENTS: OrderAmendment[] = [];

export const SEED_PRE_ORDERS: PreOrder[] = [];

export const SEED_MESSENGER_THREADS: MessengerThread[] = [];
