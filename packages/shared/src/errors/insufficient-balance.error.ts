import { DomainError } from './domain.error';

export class InsufficientBalanceError extends DomainError {
  constructor(message = 'Insufficient available balance') {
    super('INSUFFICIENT_BALANCE', message);
  }
}
