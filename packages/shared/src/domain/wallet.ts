export type CurrencyCode = string;

export interface Wallet {
  userId: string;
  currency: CurrencyCode;
  available: number;
  reserved: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
