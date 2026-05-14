"use strict";

const { BadRequestError } = require("../http/errors");

function createStripeRoutes({ stripeWebhookHandler }) {
  if (!stripeWebhookHandler) throw new Error("stripeWebhookHandler is required");

  async function handleVerifiedEvent(request) {
    const event = request.event || request.body;
    if (!event || !event.id || !event.type) throw new BadRequestError("Stripe event is required");
    return stripeWebhookHandler(event);
  }

  return {
    handleVerifiedEvent
  };
}

module.exports = {
  createStripeRoutes
};
