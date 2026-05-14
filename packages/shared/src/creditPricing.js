const creditPricing = {
  image_analysis: 5,
  prompt_generation: 3,
  listing_copy_generation: 3,
  image_generation_standard: 15,
  image_generation_hd: 25,
  image_generation_bundle_4: 80,
  export_packaging: 2
};

function getCreditCost(operation) {
  const cost = creditPricing[operation];
  if (!Number.isFinite(cost)) throw new Error(`Unknown credit operation: ${operation}`);
  return cost;
}

module.exports = { creditPricing, getCreditCost };
