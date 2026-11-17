import Dexie, { type EntityTable } from "dexie";

export interface LocalProduct {
  id: string;
  code: string;
  name: string;
  categoryId?: string;
  unit: string;
  allowsDecimals: boolean;
  price: string;
  cost: string;
  currentStock: string;
  updatedAt: string;
}

export interface LocalCustomer {
  id: string;
  name: string;
  documentId?: string;
  phone?: string;
  creditLimit: string;
  balance: string;
  status: "ACTIVE" | "BLOCKED";
  updatedAt: string;
}

export interface LocalCartItem {
  id: string;
  productId: string;
  code: string;
  name: string;
  unit: string;
  allowsDecimals: boolean;
  quantity: string;
  unitPrice: string;
  discountPct?: string;
  lineTotal: string;
}

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface OutboxOperation {
  id?: number;
  clientOpId: string; // UUID v4
  type: "SALE" | "CUSTOMER_PAYMENT" | "CASH_MOVEMENT" | "MERMA";
  payload: Record<string, JsonValue>;
  status: "PENDIENTE" | "SINCRONIZANDO" | "CONFIRMADA" | "RECHAZADA";
  localSaleNumber?: string; // OFF-0001
  error?: string;
  createdAt: string;
  syncedAt?: string;
}

export interface SyncMetadata {
  key: string;
  value: string;
}

// Base de datos IndexedDB local con Dexie
export class CarniceriaLocalDB extends Dexie {
  products!: EntityTable<LocalProduct, "id">;
  customers!: EntityTable<LocalCustomer, "id">;
  cart!: EntityTable<LocalCartItem, "id">;
  outbox!: EntityTable<OutboxOperation, "id">;
  syncMeta!: EntityTable<SyncMetadata, "key">;

  constructor() {
    super("CarniceriaKortaDB");
    this.version(1).stores({
      products: "id, code, categoryId, name",
      customers: "id, name, documentId, status",
      cart: "id, productId",
      outbox: "++id, clientOpId, type, status, createdAt",
      syncMeta: "key",
    });
  }
}

export const localDB = new CarniceriaLocalDB();
