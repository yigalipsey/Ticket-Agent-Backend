import { isValidSortField, isValidSortOrder } from "../constants/sortFields.js";

// Validate pagination parameters
export const validatePagination = (query) => {
  const { page = 1, limit = 20 } = query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  if (isNaN(pageNum) || pageNum < 1) {
    throw new Error("Page must be a positive integer");
  }

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    throw new Error("Limit must be between 1 and 100");
  }

  return { page: pageNum, limit: limitNum };
};

// Validate sort parameters
export const validateSort = (query) => {
  const { sortBy = "date", sortOrder = "asc" } = query;

  if (!isValidSortField(sortBy)) {
    throw new Error(`Invalid sort field: ${sortBy}`);
  }

  if (!isValidSortOrder(sortOrder)) {
    throw new Error(`Invalid sort order: ${sortOrder}`);
  }

  return { sortBy, sortOrder };
};

// Validate ObjectId format
export const validateObjectId = (id, fieldName = "ID") => {
  if (!id) {
    throw new Error(`${fieldName} is required`);
  }

  // If it's already an ObjectId, return as is
  if (typeof id === "object" && id.toString) {
    return id;
  }

  // If it's a string, validate format
  if (typeof id === "string") {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new Error(`Invalid ${fieldName} format`);
    }
    return id;
  }

  throw new Error(`${fieldName} must be a string or ObjectId`);
};

// Validate slug format
export const validateSlug = (slug, fieldName = "slug") => {
  if (!slug || typeof slug !== "string" || slug.trim().length === 0) {
    throw new Error(`${fieldName} is required and must be a non-empty string`);
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(
      `${fieldName} must contain only lowercase letters, numbers, and hyphens`
    );
  }

  return slug.trim();
};

// Validate external ID
export const validateExternalId = (externalId, provider) => {
  if (!externalId) {
    throw new Error("External ID is required");
  }

  if (
    provider === "apiFootball" &&
    (typeof externalId !== "number" || externalId <= 0)
  ) {
    throw new Error("API Football ID must be a positive number");
  }

  return externalId;
};

// Validate upcoming filter
export const validateUpcoming = (upcoming) => {
  if (upcoming === undefined || upcoming === null) {
    return true; // Default to upcoming
  }

  if (typeof upcoming === "string") {
    return upcoming === "true";
  }

  return Boolean(upcoming);
};
