"use strict";

function createInMemoryStripePaymentRepository() {
  const events = new Map();
  const grants = new Map();

  async function hasEvent(eventId) {
    return events.has(eventId);
  }

  async function recordEvent(event, meta = {}) {
    if (events.has(event.id)) return false;
    events.set(event.id, {
      providerEventId: event.id,
      type: event.type,
      payload: clone(event),
      meta: clone(meta),
      createdAt: new Date().toISOString()
    });
    return true;
  }

  async function recordGrant(record) {
    if (grants.has(record.grantKey)) return false;
    grants.set(record.grantKey, {
      ...clone(record),
      status: record.status || "claimed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return true;
  }

  async function getGrant(grantKey) {
    return clone(grants.get(grantKey) || null);
  }

  async function finalizeGrant(grantKey, patch = {}) {
    const current = grants.get(grantKey);
    if (!current) return null;
    const next = {
      ...current,
      ...clone(patch),
      status: patch.status || "granted",
      updatedAt: new Date().toISOString()
    };
    grants.set(grantKey, next);
    return clone(next);
  }

  async function releaseGrant(grantKey, meta = {}) {
    return grants.delete(grantKey);
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

function clone(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  createInMemoryStripePaymentRepository
};
