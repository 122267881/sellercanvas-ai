"use strict";

function createStripePaymentRepository({ prisma }) {
  if (!prisma || !prisma.stripeEvent || !prisma.creditGrant) {
    throw new Error("Prisma stripeEvent and creditGrant models are required");
  }

  async function hasEvent(eventId) {
    assertString(eventId, "Stripe event id is required");
    const event = await prisma.stripeEvent.findUnique({
      where: { providerEventId: eventId },
      select: { id: true }
    });
    return Boolean(event);
  }

  async function recordEvent(event, meta = {}) {
    assertEvent(event);
    try {
      await prisma.stripeEvent.create({
        data: {
          providerEventId: event.id,
          type: event.type,
          action: meta.action || null,
          userId: meta.userId || null,
          credits: Number.isInteger(meta.credits) ? meta.credits : null,
          grantKey: meta.grantKey || null,
          payload: sanitizeJson(event),
          meta: sanitizeJson(meta)
        }
      });
      return true;
    } catch (error) {
      if (isUniqueConflict(error)) return false;
      throw error;
    }
  }

  async function recordGrant(record) {
    assertGrantRecord(record);
    try {
      await prisma.creditGrant.create({
        data: {
          grantKey: record.grantKey,
          eventId: record.eventId || null,
          eventType: record.eventType || null,
          userId: record.userId,
          planId: record.planId,
          credits: record.credits,
          status: record.status || "claimed",
          meta: sanitizeJson(record.meta || {})
        }
      });
      return true;
    } catch (error) {
      if (isUniqueConflict(error)) return false;
      throw error;
    }
  }

  async function getGrant(grantKey) {
    assertString(grantKey, "Stripe grant key is required");
    const grant = await prisma.creditGrant.findUnique({ where: { grantKey } });
    return grant ? mapGrant(grant) : null;
  }

  async function finalizeGrant(grantKey, patch = {}) {
    assertString(grantKey, "Stripe grant key is required");
    const updated = await prisma.creditGrant.update({
      where: { grantKey },
      data: {
        eventId: patch.eventId || undefined,
        userId: patch.userId || undefined,
        planId: patch.planId || undefined,
        credits: Number.isInteger(patch.credits) ? patch.credits : undefined,
        status: patch.status || "granted",
        error: null,
        meta: sanitizeJson(patch.meta || {})
      }
    });
    return mapGrant(updated);
  }

  async function releaseGrant(grantKey, meta = {}) {
    assertString(grantKey, "Stripe grant key is required");
    try {
      await prisma.creditGrant.delete({ where: { grantKey } });
      return true;
    } catch (error) {
      if (isNotFoundError(error)) return false;
      throw error;
    }
  }

  return {
    hasEvent,
    recordEvent,
    recordGrant,
    getGrant,
    finalizeGrant,
    releaseGrant
  };
}

function mapGrant(grant) {
  return {
    id: grant.id,
    grantKey: grant.grantKey,
    eventId: grant.eventId,
    eventType: grant.eventType,
    userId: grant.userId,
    planId: grant.planId,
    credits: grant.credits,
    status: grant.status,
    error: grant.error,
    meta: sanitizeJson(grant.meta),
    createdAt: serializeDate(grant.createdAt),
    updatedAt: serializeDate(grant.updatedAt)
  };
}

function assertEvent(event) {
  if (!event || typeof event !== "object") throw new Error("Stripe event object is required");
  assertString(event.id, "Stripe event id is required");
  assertString(event.type, "Stripe event type is required");
}

function assertGrantRecord(record) {
  if (!record || typeof record !== "object") throw new Error("Stripe grant record is required");
  assertString(record.grantKey, "Stripe grant key is required");
  assertString(record.userId, "Stripe grant userId is required");
  assertString(record.planId, "Stripe grant planId is required");
  if (!Number.isInteger(record.credits) || record.credits <= 0) {
    throw new Error("Stripe grant credits must be a positive integer");
  }
}

function assertString(value, message) {
  if (!value || typeof value !== "string") throw new Error(message);
}

function sanitizeJson(value) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

function serializeDate(value) {
  return value instanceof Date ? value.toISOString() : value || null;
}

function isUniqueConflict(error) {
  return error && (error.code === "P2002" || /unique/i.test(error.message || ""));
}

function isNotFoundError(error) {
  return error && (error.code === "P2025" || /not found/i.test(error.message || ""));
}

module.exports = {
  createStripePaymentRepository
};
