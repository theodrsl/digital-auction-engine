export enum LedgerEntryType {
  RESERVE = 'RESERVE',
  RELEASE = 'RELEASE',
  CAPTURE = 'CAPTURE',
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

export enum LedgerBalanceBucket {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  EXTERNAL = 'EXTERNAL',
  SINK = 'SINK',
}
