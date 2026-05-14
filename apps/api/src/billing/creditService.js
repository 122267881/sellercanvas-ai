"use strict";

const {
  createCreditAccount,
  grantCredits,
  reserveCredits,
  consumeReservedCredits,
  refundReservedCredits
} = require("../../../../packages/billing/src/creditLedger");

function createCreditService({ repository }) {
  if (!repository) {
    throw new Error("Credit repository is required");
  }

  async function ensureAccount(userId) {
    const existing = await repository.getAccountByUserId(userId);
    if (existing) return existing;
    return repository.createAccount({ userId, balance: 0 });
  }

  async function grant(userId, amount, meta = {}) {
    return applyCreditOperation(userId, (account) => grantCredits(account, amount, meta));
  }

  async function reserve(userId, amount, meta = {}) {
    return applyCreditOperation(userId, (account) => reserveCredits(account, amount, meta));
  }

  async function consumeReserved(userId, amount, meta = {}) {
    return applyCreditOperation(userId, (account) => consumeReservedCredits(account, amount, meta));
  }

  async function refundReserved(userId, amount, meta = {}) {
    return applyCreditOperation(userId, (account) => refundReservedCredits(account, amount, meta));
  }

  async function getBalance(userId) {
    const account = await ensureAccount(userId);
    return {
      balance: account.balance,
      reserved: account.reserved,
      available: account.available
    };
  }

  async function applyCreditOperation(userId, operation) {
    const account = createCreditAccount(await ensureAccount(userId));
    const ledgerEntry = operation(account);
    const savedAccount = await repository.saveAccount(account);
    const savedLedgerEntry = await repository.appendLedger({
      userId,
      ...ledgerEntry
    });

    return {
      account: savedAccount,
      ledgerEntry: savedLedgerEntry
    };
  }

  return {
    ensureAccount,
    grant,
    reserve,
    consumeReserved,
    refundReserved,
    getBalance
  };
}

module.exports = {
  createCreditService
};
