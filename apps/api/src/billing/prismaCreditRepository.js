"use strict";

function createPrismaCreditRepository({ prisma }) {
  if (!prisma) {
    throw new Error("Prisma client is required");
  }
  if (!prisma.creditAccount || !prisma.creditLedger) {
    throw new Error("Prisma creditAccount and creditLedger models are required");
  }

  async function getAccountByUserId(userId) {
    assertUserId(userId);
    const account = await prisma.creditAccount.findUnique({
      where: { userId }
    });
    return account ? mapAccount(account) : null;
  }

  async function createAccount({ userId, balance = 0 }) {
    assertUserId(userId);
    assertNonNegativeInteger(balance, "Credit balance");

    const account = await prisma.creditAccount.create({
      data: {
        userId,
        balance,
        reserved: 0
      }
    });
    return mapAccount(account);
  }

  async function saveAccount(account) {
    assertAccount(account);

    const savedAccount = await prisma.creditAccount.update({
      where: { userId: account.userId },
      data: {
        balance: account.balance,
        reserved: account.reserved
      }
    });
    return mapAccount(savedAccount);
  }

  async function appendLedger(entry) {
    assertLedgerEntry(entry);

    const account = await prisma.creditAccount.findUnique({
      where: { userId: entry.userId },
      select: { id: true, userId: true }
    });
    if (!account) {
      throw new Error(`Credit account not found for user ${entry.userId}`);
    }

    const savedEntry = await prisma.creditLedger.create({
      data: {
        creditAccountId: account.id,
        type: entry.type,
        amount: entry.amount,
        balanceBefore: entry.balanceBefore,
        balanceAfter: entry.balanceAfter,
        reservedBefore: entry.reservedBefore,
        reservedAfter: entry.reservedAfter,
        jobId: entry.jobId || null,
        paymentId: entry.paymentId || null,
        meta: entry.meta || null,
        ...(entry.createdAt ? { createdAt: entry.createdAt } : {})
      }
    });

    return mapLedgerEntry(savedEntry, account.userId);
  }

  async function listLedger(userId) {
    assertUserId(userId);

    const account = await prisma.creditAccount.findUnique({
      where: { userId },
      select: { id: true, userId: true }
    });
    if (!account) return [];

    const entries = await prisma.creditLedger.findMany({
      where: { creditAccountId: account.id },
      orderBy: { createdAt: "asc" }
    });
    return entries.map((entry) => mapLedgerEntry(entry, account.userId));
  }

  return {
    getAccountByUserId,
    createAccount,
    saveAccount,
    appendLedger,
    listLedger
  };
}

function assertUserId(userId) {
  if (!userId || typeof userId !== "string") {
    throw new Error("Credit account userId is required");
  }
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

function assertAccount(account) {
  if (!account || typeof account !== "object") {
    throw new Error("Credit account is required");
  }
  assertUserId(account.userId);
  assertNonNegativeInteger(account.balance, "Credit balance");
  assertNonNegativeInteger(account.reserved, "Reserved credits");
  if (account.reserved > account.balance) {
    throw new Error("Reserved credits cannot exceed balance");
  }
  if (account.available !== account.balance - account.reserved) {
    throw new Error("Credit account available balance is inconsistent");
  }
}

function assertLedgerEntry(entry) {
  if (!entry || typeof entry !== "object") {
    throw new Error("Ledger entry is required");
  }
  assertUserId(entry.userId);
  assertLedgerType(entry.type);
  assertPositiveInteger(entry.amount, "Credit ledger amount");
  assertNonNegativeInteger(entry.balanceBefore, "Credit ledger balanceBefore");
  assertNonNegativeInteger(entry.balanceAfter, "Credit ledger balanceAfter");
  assertNonNegativeInteger(entry.reservedBefore, "Credit ledger reservedBefore");
  assertNonNegativeInteger(entry.reservedAfter, "Credit ledger reservedAfter");
}

function assertLedgerType(type) {
  const validTypes = new Set(["GRANT", "RESERVE", "CONSUME", "REFUND", "EXPIRE", "ADMIN_ADJUST"]);
  if (!validTypes.has(type)) {
    throw new Error("Credit ledger type is invalid");
  }
}

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function mapAccount(account) {
  return {
    userId: account.userId,
    balance: account.balance,
    reserved: account.reserved,
    available: account.balance - account.reserved
  };
}

function mapLedgerEntry(entry, userId) {
  return {
    id: entry.id,
    userId,
    type: entry.type,
    amount: entry.amount,
    balanceBefore: entry.balanceBefore,
    balanceAfter: entry.balanceAfter,
    reservedBefore: entry.reservedBefore,
    reservedAfter: entry.reservedAfter,
    jobId: entry.jobId,
    paymentId: entry.paymentId,
    meta: cloneMeta(entry.meta),
    createdAt: serializeCreatedAt(entry.createdAt)
  };
}

function cloneMeta(meta) {
  if (!meta || typeof meta !== "object" || meta instanceof Date) {
    return meta;
  }
  if (Array.isArray(meta)) {
    return meta.map(cloneMeta);
  }
  return Object.fromEntries(Object.entries(meta).map(([key, value]) => [key, cloneMeta(value)]));
}

function serializeCreatedAt(createdAt) {
  return createdAt instanceof Date ? createdAt.toISOString() : createdAt;
}

module.exports = {
  createPrismaCreditRepository
};
