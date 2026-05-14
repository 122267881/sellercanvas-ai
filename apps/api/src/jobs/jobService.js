const {
  getCreditCostForJobType,
  getCreditOperationForJobType,
  isSupportedJobType
} = require("../../../../workers/ai/src/jobTypes");
const { PaymentRequiredError } = require("../http/errors");

function createJobService({ jobRepository, creditService }) {
  assertRepository(jobRepository);
  assertCreditService(creditService);

  async function createJob({ userId, projectId, type, input = {} }) {
    assertRequired(userId, "Job userId is required");
    assertRequired(projectId, "Job projectId is required");
    assertRequired(type, "Job type is required");

    if (!isSupportedJobType(type)) {
      throw new Error(`Unsupported AI job type: ${type}`);
    }

    const creditOperation = getCreditOperationForJobType(type);
    const creditAmount = getCreditCostForJobType(type);
    const job = await jobRepository.create({
      userId,
      projectId,
      type,
      status: "QUEUED",
      creditOperation,
      creditAmount,
      input
    });

    try {
      await creditService.reserve(userId, creditAmount, {
        jobId: job.id,
        projectId,
        jobType: type,
        operation: creditOperation
      });
    } catch (error) {
      await jobRepository.update(job.id, {
        status: "FAILED",
        error: normalizeError(error),
        failedAt: new Date().toISOString()
      });
      if (/Insufficient credits/i.test(error.message || "")) {
        throw new PaymentRequiredError("Insufficient credits");
      }
      throw error;
    }

    return jobRepository.get(job.id);
  }

  async function markSucceeded(jobId, output = {}) {
    const job = await getExistingJob(jobId);
    if (job.status === "SUCCEEDED") return job;
    if (job.status === "FAILED" || job.status === "REFUNDED") {
      throw new Error(`Cannot succeed job in ${job.status} status`);
    }

    await creditService.consumeReserved(job.userId, job.creditAmount, creditMeta(job));
    return jobRepository.update(job.id, {
      status: "SUCCEEDED",
      output,
      error: null,
      succeededAt: new Date().toISOString()
    });
  }

  async function markFailed(jobId, error) {
    const job = await getExistingJob(jobId);
    if (job.status === "FAILED" || job.status === "REFUNDED") return job;
    if (job.status === "SUCCEEDED") {
      throw new Error("Cannot fail a succeeded job");
    }

    await creditService.refundReserved(job.userId, job.creditAmount, creditMeta(job));
    return jobRepository.update(job.id, {
      status: "FAILED",
      error: normalizeError(error),
      failedAt: new Date().toISOString()
    });
  }

  async function getExistingJob(jobId) {
    assertRequired(jobId, "Job id is required");
    const job = await jobRepository.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    return job;
  }

  return {
    createJob,
    markSucceeded,
    markFailed
  };
}

function creditMeta(job) {
  return {
    jobId: job.id,
    projectId: job.projectId,
    jobType: job.type,
    operation: job.creditOperation
  };
}

function normalizeError(error) {
  if (!error) return null;
  if (typeof error === "string") return error;
  return error.message || String(error);
}

function assertRequired(value, message) {
  if (!value) throw new Error(message);
}

function assertRepository(jobRepository) {
  for (const method of ["create", "update", "get", "list"]) {
    if (!jobRepository || typeof jobRepository[method] !== "function") {
      throw new Error(`Job repository must implement ${method}()`);
    }
  }
}

function assertCreditService(creditService) {
  for (const method of ["reserve", "consumeReserved", "refundReserved"]) {
    if (!creditService || typeof creditService[method] !== "function") {
      throw new Error(`Credit service must implement ${method}()`);
    }
  }
}

module.exports = { createJobService };
