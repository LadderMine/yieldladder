export class YieldLadderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YieldLadderError';
  }
}

export class LockNotExpiredError extends YieldLadderError {
  constructor() { super('Lock period has not expired yet'); this.name = 'LockNotExpiredError'; }
}

export class BelowMinDepositError extends YieldLadderError {
  constructor() { super('Amount is below the minimum deposit'); this.name = 'BelowMinDepositError'; }
}