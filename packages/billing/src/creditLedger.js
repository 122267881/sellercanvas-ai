function assertPositiveAmount(amount) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Credit amount must be a positive integer");
  }
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

function createCreditAccount({ userId, balance = 0, reserved = 0 }) {
  if (!userId) throw new Error("Credit account userId is required");
  assertNonNegativeInteger(balance, "Credit balance");
  assertNonNegativeInteger(reserved, "Reserved credits");
  if (reserved > balance) throw new Error("Reserved credits cannot exceed balance");
  return {
    userId,
    balance,
    reserved,
    available: balance - reserved
  };
}

function grantCredits(account, amount, meta = {}) {
  assertPositiveAmount(amount);
  const balanceBefore = account.balance;
  const reservedBefore = account.reserved;
  account.balance += amount;
  account.available = account.balance - account.reserved;
  return ledgerEntry("GRANT", amount, balanceBefore, account.balance, reservedBefore, account.reserved, meta);
}

function reserveCredits(account, amount, meta = {}) {
  assertPositiveAmount(amount);
  if (account.balance - account.reserved < amount) {
    throw new Error("Insufficient credits");
  }
  const balanceBefore = account.balance;
  const reservedBefore = account.reserved;
  account.reserved += amount;
  account.available = account.balance - account.reserved;
  return ledgerEntry("RESERVE", amount, balanceBefore, account.balance, reservedBefore, account.reserved, meta);
}

function consumeReservedCredits(account, amount, meta = {}) {
  assertPositiveAmount(amount);
  if (account.reserved < amount) {
    throw new Error("Insufficient reserved credits");
  }
  const balanceBefore = account.balance;
  const reservedBefore = account.reserved;
  account.reserved -= amount;
  account.balance -= amount;
  account.available = account.balance - account.reserved;
  return ledgerEntry("CONSUME", amount, balanceBefore, account.balance, reservedBefore, account.reserved, meta);
}

function refundReservedCredits(account, amount, meta = {}) {
  assertPositiveAmount(amount);
  if (account.reserved < amount) {
    throw new Error("Insufficient reserved credits");
  }
  const balanceBefore = account.balance;
  const reservedBefore = account.reserved;
  account.reserved -= amount;
  account.available = account.balance - account.reserved;
  return ledgerEntry("REFUND", amount, balanceBefore, account.balance, reservedBefore, account.reserved, meta);
}

function ledgerEntry(type, amount, balanceBefore, balanceAfter, reservedBefore, reservedAfter, meta) {
  return {
    type,
    amount,
    balanceBefore,
    balanceAfter,
    reservedBefore,
    reservedAfter,
    meta,
    createdAt: new Date().toISOString()
  };
}

module.exports = {
  createCreditAccount,
  grantCredits,
  reserveCredits,
  consumeReservedCredits,
  refundReservedCredits
};
