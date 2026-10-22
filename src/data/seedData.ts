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
    title: `NEW SHOP · ${todayDate}`,
    status: 'ended',
    startedAt: morningStartIso,
    endedAt: new Date().toISOString(),
    fbVideoId: '1126219396590785',
    videoUrl: 'https://www.facebook.com/watch/?v=1126219396590785',
    storeName: 'Pratunam Market Wholesale Floor',
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
