const SUPPORTED_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.deleted"
]);

function createStripeWebhookHandler({ creditService, paymentRepository, plans } = {}) {
  assertDependency(creditService && creditService.grant, "creditService.grant");
  assertDependency(paymentRepository && paymentRepository.hasEvent, "paymentRepository.hasEvent");
  assertDependency(paymentRepository && paymentRepository.recordEvent, "paymentRepository.recordEvent");

  const planCatalog = normalizePlans(plans);

  return async function handleStripeWebhook(event) {
    assertEvent(event);

    const object = getStripeObject(event);
    const userId = extractUserId(object);

    if (!SUPPORTED_EVENT_TYPES.has(event.type)) {
      return result(false, "ignored", userId, 0);
    }

    if (await paymentRepository.hasEvent(event.id)) {
      return result(true, "duplicate", userId, 0);
    }

    const action = getAction(event, object, planCatalog, userId);
    const grantKey = action.grant ? getGrantKey(event, object, action) : null;
    if (action.grant) {
      const claim = await claimGrant(paymentRepository, grantKey, event, action);
      if (!claim.claimed && claim.completed) {
        await recordEvent(paymentRepository, event, { action: "duplicate_grant", userId, grantKey });
        return result(true, "duplicate_grant", userId, 0);
      }

      try {
        await creditService.grant(action.userId, action.credits, {
          provider: "stripe",
          eventId: event.id,
          eventType: event.type,
          stripeObjectId: object && object.id,
          plan: action.plan.id,
          grantKey
        });
        await finalizeGrant(paymentRepository, grantKey, event, action);
      } catch (error) {
        await releaseGrant(paymentRepository, grantKey, event, error);
        throw error;
      }
    }

    const recordResult = await recordEvent(paymentRepository, event, {
      action: action.name,
      userId: action.userId,
      credits: action.credits,
      grantKey
    });
    if (recordResult === false) return result(true, "duplicate", userId, 0);

    return result(true, action.name, action.userId, action.credits);
  };
}

async function claimGrant(paymentRepository, grantKey, event, action) {
  if (!grantKey) throw new Error("Stripe credit grant key is required");
  assertDependency(paymentRepository && paymentRepository.recordGrant, "paymentRepository.recordGrant");
  const claimResult = await paymentRepository.recordGrant({
    grantKey,
    eventId: event.id,
    eventType: event.type,
    userId: action.userId,
    planId: action.plan.id,
    credits: action.credits,
    status: "claimed"
  });
  if (claimResult !== false) return { claimed: true, completed: false };

  const existingGrant = await getGrant(paymentRepository, grantKey);
  if (existingGrant && ["granted", "completed"].includes(String(existingGrant.status || "").toLowerCase())) {
    return { claimed: false, completed: true };
  }

  throw new Error("Stripe credit grant is already being processed; retry later");
}

async function getGrant(paymentRepository, grantKey) {
  if (!grantKey || typeof paymentRepository.getGrant !== "function") return null;
  return paymentRepository.getGrant(grantKey);
}

async function finalizeGrant(paymentRepository, grantKey, event, action) {
  if (!grantKey || typeof paymentRepository.finalizeGrant !== "function") return;
  await paymentRepository.finalizeGrant(grantKey, {
    eventId: event.id,
    userId: action.userId,
    planId: action.plan.id,
    credits: action.credits,
    status: "granted"
  });
}

async function releaseGrant(paymentRepository, grantKey, event, error) {
  if (!grantKey || typeof paymentRepository.releaseGrant !== "function") return;
  await paymentRepository.releaseGrant(grantKey, {
    eventId: event.id,
    error: error && error.message ? error.message : String(error)
  });
}

async function recordEvent(paymentRepository, event, meta) {
  return paymentRepository.recordEvent(event, meta);
}

function getAction(event, object, planCatalog, userId) {
  if (event.type === "checkout.session.completed") {
    if (!isPaidCheckoutSession(object)) {
      return { name: "checkout_not_paid", userId, credits: 0, grant: false };
    }
    return creditGrantAction(event, object, planCatalog, userId);
  }

  if (event.type === "invoice.paid") {
    return creditGrantAction(event, object, planCatalog, userId);
  }

  if (event.type === "invoice.payment_failed") {
    return { name: "payment_failed", userId, credits: 0, grant: false };
  }

  return { name: "subscription_deleted", userId, credits: 0, grant: false };
}

function creditGrantAction(event, object, planCatalog, userId) {
  if (!userId) {
    throw new Error(`${event.type} is missing userId metadata`);
  }

  const plan = resolvePlan(object, planCatalog);
  if (!plan) {
    throw new Error(`${event.type} is missing a known plan`);
  }

  if (!Number.isInteger(plan.credits) || plan.credits <= 0) {
    throw new Error(`Plan ${plan.id} must define positive integer credits`);
  }

  return {
    name: "grant_credits",
    userId,
    credits: plan.credits,
    plan,
    grant: true
  };
}

function getGrantKey(event, object, action) {
  if (!event || (event.type !== "checkout.session.completed" && event.type !== "invoice.paid")) return null;
  const subscriptionId = getSubscriptionId(object);
  const invoiceId = object && (object.invoice || object.id);
  const planId = action && action.plan && action.plan.id;
  if (!planId) throw new Error(`${event.type} is missing a canonical plan id`);
  if (subscriptionId) return `subscription:${subscriptionId}:plan:${planId}`;
  if (invoiceId) return `invoice:${invoiceId}:plan:${planId}`;
  return `user:${action.userId || "unknown"}:event-object:${object && object.id || event.id}:plan:${planId}`;
}

function getSubscriptionId(object) {
  if (!object) return null;
  if (typeof object.subscription === "string") return object.subscription;
  if (object.subscription && typeof object.subscription.id === "string") return object.subscription.id;
  if (object.parent && object.parent.subscription_details && typeof object.parent.subscription_details.subscription === "string") {
    return object.parent.subscription_details.subscription;
  }
  return null;
}

function normalizePlans(plans) {
  if (!plans) return [];

  if (Array.isArray(plans)) {
    return plans.map((plan) => ({ ...plan }));
  }

  if (typeof plans === "object") {
    return Object.entries(plans).map(([id, plan]) => ({
      ...plan,
      id: plan.id || id
    }));
  }

  throw new Error("plans must be an array or object");
}

function resolvePlan(object, plans) {
  const planCandidates = collectMetadataValues(object, [
    "plan",
    "planId",
    "plan_id",
    "subscriptionPlan",
    "subscription_plan"
  ]);

  for (const candidate of planCandidates) {
    const plan = plans.find((item) => stringMatchesAny(candidate, [item.id, item.name, item.slug]));
    if (plan) return plan;
  }

  const priceIds = collectPriceIds(object);
  return plans.find((plan) => {
    const planPriceIds = [plan.stripePriceId, ...(Array.isArray(plan.stripePriceIds) ? plan.stripePriceIds : [])];
    return priceIds.some((priceId) => planPriceIds.includes(priceId));
  });
}

function extractUserId(object) {
  const candidates = collectMetadataValues(object, ["userId", "user_id", "user"]);
  if (object && object.client_reference_id) candidates.push(object.client_reference_id);
  return candidates.find(Boolean) || null;
}

function collectMetadataValues(object, keys) {
  return metadataSources(object)
    .flatMap((metadata) => keys.map((key) => metadata && metadata[key]))
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim());
}

function metadataSources(object) {
  const lineItems = getLineItems(object);
  return [
    object && object.metadata,
    object && object.subscription_details && object.subscription_details.metadata,
    ...lineItems.flatMap((line) => [
      line.metadata,
      line.price && line.price.metadata,
      line.plan && line.plan.metadata
    ])
  ].filter(Boolean);
}

function collectPriceIds(object) {
  const ids = [];
  const lineItems = getLineItems(object);

  if (object && object.metadata && object.metadata.stripePriceId) {
    ids.push(object.metadata.stripePriceId);
  }

  for (const line of lineItems) {
    ids.push(
      line.price && line.price.id,
      line.plan && line.plan.id,
      line.pricing && line.pricing.price_details && line.pricing.price_details.price
    );
  }

  return ids.filter((value) => typeof value === "string" && value.trim());
}

function getLineItems(object) {
  const fromInvoice = object && object.lines && Array.isArray(object.lines.data) ? object.lines.data : [];
  const fromCheckout = object && object.line_items && Array.isArray(object.line_items.data) ? object.line_items.data : [];
  return [...fromInvoice, ...fromCheckout];
}

function isPaidCheckoutSession(session) {
  if (!session) return false;
  return session.payment_status === "paid" || (session.status === "complete" && !session.payment_status);
}

function stringMatchesAny(value, candidates) {
  const normalizedValue = String(value).toLowerCase();
  return candidates
    .filter(Boolean)
    .some((candidate) => String(candidate).toLowerCase() === normalizedValue);
}

function getStripeObject(event) {
  return event && event.data && event.data.object ? event.data.object : {};
}

function assertDependency(value, label) {
  if (typeof value !== "function") {
    throw new Error(`${label} is required`);
  }
}

function assertEvent(event) {
  if (!event || typeof event !== "object") {
    throw new Error("Stripe event object is required");
  }
  if (!event.id) {
    throw new Error("Stripe event id is required");
  }
  if (!event.type) {
    throw new Error("Stripe event type is required");
  }
}

function result(handled, action, userId, credits) {
  return {
    handled,
    action,
    userId: userId || null,
    credits
  };
}

module.exports = {
  createStripeWebhookHandler
};
