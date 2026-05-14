"use strict";

const { ForbiddenError, BadRequestError } = require("../http/errors");
const { canAccessUserResource, requireInternal, requireUser } = require("../security/permissions");

function createJobRoutes({ jobService, jobRepository }) {
  if (!jobService || !jobRepository) throw new Error("jobService and jobRepository are required");

  async function createJob(request) {
    const user = requireUser(request);
    const body = request.body || {};
    if (!body.projectId) throw new BadRequestError("projectId is required");
    if (!body.type) throw new BadRequestError("type is required");

    const job = await jobService.createJob({
      userId: user.id,
      projectId: body.projectId,
      type: body.type,
      input: body.input || {}
    });
    return { job };
  }

  async function getJob(request) {
    const user = requireUser(request);
    const jobId = request.params?.jobId;
    if (!jobId) throw new BadRequestError("jobId is required");
    const job = await jobRepository.get(jobId);
    if (!job) return { job: null };
    if (!canAccessUserResource(user, job.userId)) throw new ForbiddenError("Cannot access this job");
    return { job };
  }

  async function markSucceeded(request) {
    requireInternal(request);
    const jobId = request.params?.jobId;
    if (!jobId) throw new BadRequestError("jobId is required");
    return { job: await jobService.markSucceeded(jobId, request.body?.output || {}) };
  }

  async function markFailed(request) {
    requireInternal(request);
    const jobId = request.params?.jobId;
    if (!jobId) throw new BadRequestError("jobId is required");
    return { job: await jobService.markFailed(jobId, request.body?.error || "Job failed") };
  }

  return {
    createJob,
    getJob,
    markSucceeded,
    markFailed
  };
}

module.exports = {
  createJobRoutes
};
