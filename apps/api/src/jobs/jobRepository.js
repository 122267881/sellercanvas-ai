function createInMemoryJobRepository(initialJobs = []) {
  const jobs = new Map();
  let nextId = 1;

  for (const job of initialJobs) {
    if (!job || !job.id) throw new Error("Initial job id is required");
    jobs.set(job.id, clone(job));
  }

  function create(job) {
    if (!job || !job.userId) throw new Error("Job userId is required");
    if (!job.projectId) throw new Error("Job projectId is required");
    if (!job.type) throw new Error("Job type is required");

    const now = new Date().toISOString();
    const record = {
      id: job.id || createJobId(nextId++),
      status: "QUEUED",
      input: {},
      output: null,
      error: null,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
      ...clone(job)
    };

    if (!record.createdAt) record.createdAt = now;
    if (!record.updatedAt) record.updatedAt = now;
    jobs.set(record.id, clone(record));
    return clone(record);
  }

  function update(jobId, patch) {
    if (!jobId) throw new Error("Job id is required");
    if (!jobs.has(jobId)) return null;

    const current = jobs.get(jobId);
    const next = {
      ...current,
      ...clone(patch || {}),
      id: current.id,
      updatedAt: new Date().toISOString()
    };

    jobs.set(jobId, clone(next));
    return clone(next);
  }

  function get(jobId) {
    if (!jobId) throw new Error("Job id is required");
    const job = jobs.get(jobId);
    return job ? clone(job) : null;
  }

  function list(filters = {}) {
    return Array.from(jobs.values())
      .filter((job) => matchesFilters(job, filters))
      .map(clone);
  }

  return {
    create,
    update,
    get,
    list
  };
}

function createJobId(sequence) {
  return `job_${Date.now().toString(36)}_${String(sequence).padStart(6, "0")}`;
}

function matchesFilters(job, filters) {
  for (const [key, value] of Object.entries(filters || {})) {
    if (value === undefined || value === null) continue;
    if (job[key] !== value) return false;
  }
  return true;
}

function clone(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

module.exports = { createInMemoryJobRepository };
