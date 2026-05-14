const { getCreditCost } = require("../../../packages/shared/src/creditPricing");

const JOB_TYPES = Object.freeze({
  IMAGE_ANALYSIS: "IMAGE_ANALYSIS",
  PROMPT_GENERATION: "PROMPT_GENERATION",
  IMAGE_GENERATION: "IMAGE_GENERATION",
  LISTING_COPY_GENERATION: "LISTING_COPY_GENERATION",
  EXPORT_PACKAGING: "EXPORT_PACKAGING"
});

const JOB_CREDIT_OPERATIONS = Object.freeze({
  [JOB_TYPES.IMAGE_ANALYSIS]: "image_analysis",
  [JOB_TYPES.PROMPT_GENERATION]: "prompt_generation",
  [JOB_TYPES.IMAGE_GENERATION]: "image_generation_bundle_4",
  [JOB_TYPES.LISTING_COPY_GENERATION]: "listing_copy_generation",
  [JOB_TYPES.EXPORT_PACKAGING]: "export_packaging"
});

const SUPPORTED_JOB_TYPES = Object.freeze(Object.values(JOB_TYPES));

function isSupportedJobType(type) {
  return Object.prototype.hasOwnProperty.call(JOB_CREDIT_OPERATIONS, type);
}

function getCreditOperationForJobType(type) {
  const operation = JOB_CREDIT_OPERATIONS[type];
  if (!operation) {
    throw new Error(`Unsupported AI job type: ${type}`);
  }
  return operation;
}

function getCreditCostForJobType(type) {
  return getCreditCost(getCreditOperationForJobType(type));
}

module.exports = {
  JOB_TYPES,
  JOB_CREDIT_OPERATIONS,
  SUPPORTED_JOB_TYPES,
  getCreditOperationForJobType,
  getCreditCostForJobType,
  isSupportedJobType
};
