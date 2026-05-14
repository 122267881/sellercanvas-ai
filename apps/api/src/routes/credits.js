"use strict";

const { BadRequestError } = require("../http/errors");
const { requireAdmin, requireUser } = require("../security/permissions");

function createCreditRoutes({ creditService }) {
  if (!creditService) throw new Error("creditService is required");

  async function getBalance(request) {
    const user = requireUser(request);
    const targetUserId = request.params?.userId || user.id;
    if (targetUserId !== user.id) requireAdmin(request);
    return { balance: await creditService.getBalance(targetUserId) };
  }

  async function grantCredits(request) {
    requireAdmin(request);
    const body = request.body || {};
    if (!body.userId) throw new BadRequestError("userId is required");
    if (!Number.isInteger(body.amount) || body.amount <= 0) {
      throw new BadRequestError("amount must be a positive integer");
    }
    return creditService.grant(body.userId, body.amount, {
      source: "admin",
      reason: body.reason || "manual_adjustment",
      actorId: request.user.id
    });
  }

  return {
    getBalance,
    grantCredits
  };
}

module.exports = {
  createCreditRoutes
};
