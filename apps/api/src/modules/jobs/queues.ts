export const QUEUE_ROUND_CLOSE = 'round-close';
export const QUEUE_SETTLEMENT = 'settlement';

export const JOB_CLOSE_ROUND = 'close-round';
export const JOB_SETTLE_ALLOCATION = 'settle-allocation';

export function closeRoundJobId(roundId: string) {
  return `round-close__${roundId}`;
}

export function settleAllocationJobId(allocationId: string) {
  return `settlement__${allocationId}`;
}

