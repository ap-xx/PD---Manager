export interface Item {
  /** Stable identifier derived from the icon's path, e.g. "Weapons/Primary/M4A1_Icon" */
  id: string;
  category: string;
  subcategory: string | null;
  group: string | null;
  name: string;
  /** Path to the .webp icon, relative to the site root (served from public/) */
  icon: string;
}

export type Account = 'notakxz' | 'RepairKitMan' | 'megagabriel10';

/** A single snapshot of an entry's unit price, recorded whenever it changes. */
export interface PricePoint {
  price: number;
  /** ISO timestamp of when this price was set. */
  date: string;
}

export interface StockEntry {
  id: string;
  itemId: string;
  account: Account;
  quantity: number;
  price: number;
  /** Chronological log of price changes (oldest first), capped to a small size.
   *  Optional so entries imported/saved before this feature still load fine. */
  priceHistory?: PricePoint[];
}
