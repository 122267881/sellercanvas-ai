"use strict";

function createInMemoryCreditRepository() {
  const accountsByUserId = new Map();
  const ledgerEntries = [];
  let nextLedgerId = 1;

  function getAccountByUserId(userId) {
    const account = accountsByUserId.get(userId);
    return account ? cloneAccount(account) : null;
  }

  function createAccount({ userId, balance = 0 }) {
    assertUserId(userId);
    assertNonNegativeInteger(balance, "Credit balance");
    if (accountsByUserId.has(userId)) {
      throw new Error(`Credit account already exists for user ${userId}`);
    }

    const account = {
      userId,
      balance,
      reserved: 0,
      available: balance
    };
    accountsByUserId.set(userId, cloneAccount(account));
    return cloneAccount(account);
  }

  function saveAccount(account) {
    assertAccount(account);
    accountsByUserId.set(account.userId, cloneAccount(account));
    return cloneAccount(account);
  }

  function appendLedger(entry) {
    if (!entry || typeof entry !== "object") {
      throw new Error("Ledger entry is required");
    }
    assertUserId(entry.userId);

    const saved = {
      id: entry.id || `credit_ledger_${nextLedgerId++}`,
      ...cloneLedgerEntry(entry)
    };
    ledgerEntries.push(saved);
    return cloneLedgerEntry(saved);
  }

  function listLedger(userId) {
    assertUserId(userId);
    return ledgerEntries
      .filter((entry) => entry.userId === userId)
      .map(cloneLedgerEntry);
  }

  function listAccounts() {
    return Array.from(accountsByUserId.values()).map(cloneAccount);
  }

  function listAllLedger() {
    return ledgerEntries.map(cloneLedgerEntry);
  }

  return {
    getAccountByUserId,
    createAccount,
    saveAccount,
    appendLedger,
    listLedger,
    listAccounts,
    listAllLedger
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

function cloneAccount(account) {
  return {
    userId: account.userId,
    balance: account.balance,
    reserved: account.reserved,
    available: account.available
  };
}

function cloneLedgerEntry(entry) {
  return {
    ...entry,
    meta: entry.meta && typeof entry.meta === "object" ? { ...entry.meta } : entry.meta
  };
}

module.exports = {
  createInMemoryCreditRepository
};
