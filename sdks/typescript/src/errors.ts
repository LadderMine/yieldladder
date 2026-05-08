export class YieldLadderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YieldLadderError';
  }
}

export class LockNotExpiredError extends YieldLadderError {
  constructor() {
    super('Position lock period has not yet elapsed. Use earlyExit() to withdraw before maturity.');
    this.name = 'LockNotExpiredError';
  }
}

export class BelowMinDepositError extends YieldLadderError {
  constructor(minDeposit: string) {
    super(`Deposit amount is below the minimum required: ${minDeposit} USDC.`);
    this.name = 'BelowMinDepositError';
  }
}
