// Allowed sort fields for football events
export const ALLOWED_SORT_FIELDS = {
  DATE: "date",
  ROUND: "round",
  ROUND_NUMBER: "roundNumber",
  CREATED_AT: "createdAt",
  UPDATED_AT: "updatedAt",
  FIXTURE_ID: "fixtureId",
};

// Default sort configuration
export const DEFAULT_SORT = {
  FIELD: ALLOWED_SORT_FIELDS.DATE,
  ORDER: "asc",
};

// Sort order options
export const SORT_ORDERS = {
  ASC: "asc",
  DESC: "desc",
};

// Validate sort field
export const isValidSortField = (field) => {
  return Object.values(ALLOWED_SORT_FIELDS).includes(field);
};

// Validate sort order
export const isValidSortOrder = (order) => {
  return Object.values(SORT_ORDERS).includes(order);
};
