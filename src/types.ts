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

export interface StockEntry {
  id: string;
  itemId: string;
  account: Account;
  quantity: number;
  price: number;
}
