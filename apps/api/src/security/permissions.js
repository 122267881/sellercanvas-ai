"use strict";

const { ForbiddenError, UnauthorizedError } = require("../http/errors");

function requireUser(request) {
  const user = request && request.user;
  if (!user || !user.id) throw new UnauthorizedError("Login required");
  return user;
}

function requireAdmin(request) {
  const user = requireUser(request);
  if (user.role !== "admin" && user.role !== "ADMIN") throw new ForbiddenError("Admin access required");
  return user;
}

function requireInternal(request) {
  if (!request || request.internal !== true) throw new ForbiddenError("Internal worker access required");
  return true;
}

function canAccessUserResource(user, ownerUserId) {
  return user && (user.id === ownerUserId || user.role === "admin" || user.role === "ADMIN");
}

module.exports = {
  requireUser,
  requireAdmin,
  requireInternal,
  canAccessUserResource
};
