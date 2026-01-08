import { DomainError } from './domain.error';

export class InvalidBidError extends DomainError {
  constructor(message = 'Invalid bid') {
    super('INVALID_BID', message);
  }
}
