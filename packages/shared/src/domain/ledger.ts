import { CurrencyCode } from './wallet';
import { LedgerBalanceBucket, LedgerEntryType } from '../enums/ledger-type';

export interface LedgerEntry {
  entryKey: string; // idempotency key (unique)
  userId: string;
  currency: CurrencyCode;
  type: LedgerEntryType;
  amount: number;

  from: LedgerBalanceBucket;
  to: LedgerBalanceBucket;

  auctionId?: string;
  roundId?: string;
  bidId?: string;
  bidEventId?: string;

  createdAt: Date;
  meta?: Record<string, unknown>;
}
