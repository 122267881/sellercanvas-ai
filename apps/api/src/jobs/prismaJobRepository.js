"use strict";

function createPrismaJobRepository({ prisma }) {
  if (!prisma || !prisma.generationJob) {
    throw new Error("Prisma generationJob model is required");
  }

  async function create(job) {
    assertJobInput(job);

    const created = await prisma.generationJob.create({
      data: {
        userId: job.userId,
        projectId: job.projectId,
        type: job.type,
        status: job.status || "QUEUED",
        provider: job.provider || null,
        model: job.model || null,
        creditOperation: job.creditOperation || null,
        creditAmount: job.creditAmount,
        input: job.input || {},
        output: job.output || null,
        error: job.error || null,
        retryCount: job.retryCount || 0
      },
      include: projectUserInclude()
    });

    return mapJob(created, job.userId);
  }

  async function update(jobId, patch) {
    assertJobId(jobId);

    try {
      const updated = await prisma.generationJob.update({
        where: { id: jobId },
        data: normalizePatch(patch),
        include: projectUserInclude()
      });
      return mapJob(updated);
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }
  }

  async function get(jobId) {
    assertJobId(jobId);
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId },
      include: projectUserInclude()
    });
    return job ? mapJob(job) : null;
  }

  async function list(filters = {}) {
    const jobs = await prisma.generationJob.findMany({
      where: normalizeFilters(filters),
      include: projectUserInclude(),
      orderBy: { createdAt: "desc" }
    });
    return jobs.map((job) => mapJob(job));
  }

  return { create, update, get, list };
}

function projectUserInclude() {
  return { project: { select: { userId: true } }, user: { select: { id: true } } };
}

function normalizePatch(patch = {}) {
  const allowed = [
    "status",
    "provider",
    "model",
    "creditOperation",
    "output",
    "error",
    "retryCount",
    "succeededAt",
    "failedAt"
  ];
  const data = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) data[key] = patch[key];
  }
  return data;
}

function normalizeFilters(filters = {}) {
  const where = {};
  for (const key of ["userId", "projectId", "status", "type"]) {
    if (filters[key] !== undefined && filters[key] !== null) where[key] = filters[key];
  }
  return where;
}

function mapJob(job, fallbackUserId) {
  return {
    id: job.id,
    userId: job.userId || job.user?.id || job.project?.userId || fallbackUserId,
    projectId: job.projectId,
    type: job.type,
    status: job.status,
    provider: job.provider,
    model: job.model,
    creditOperation: job.creditOperation,
    creditAmount: job.creditAmount,
    input: cloneJson(job.input || {}),
    output: cloneJson(job.output),
    error: job.error,
    retryCount: job.retryCount || 0,
    createdAt: serializeDate(job.createdAt),
    updatedAt: serializeDate(job.updatedAt),
    succeededAt: serializeDate(job.succeededAt),
    failedAt: serializeDate(job.failedAt)
  };
}

function assertJobInput(job) {
  if (!job || typeof job !== "object") throw new Error("Job input is required");
  if (!job.userId) throw new Error("Job userId is required");
  if (!job.projectId) throw new Error("Job projectId is required");
  if (!job.type) throw new Error("Job type is required");
  if (!Number.isInteger(job.creditAmount) || job.creditAmount <= 0) {
    throw new Error("Job creditAmount must be a positive integer");
  }
}

function assertJobId(jobId) {
  if (!jobId || typeof jobId !== "string") throw new Error("Job id is required");
}

function cloneJson(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function serializeDate(value) {
  return value instanceof Date ? value.toISOString() : value || null;
}

function isNotFoundError(error) {
  return error && (error.code === "P2025" || /not found/i.test(error.message || ""));
}

module.exports = {
  createPrismaJobRepository
};
