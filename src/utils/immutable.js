/**
 * Utility functions for creating immutable copies of objects
 * and handling MongoDB ObjectId conversion
 */

/**
 * Converts MongoDB ObjectId to string recursively
 * @param {any} obj - The object to convert
 * @returns {any} Object with ObjectIds converted to strings
 */
export const normalizeObjectIds = (obj) => {
  if (obj === null || obj === undefined) return obj;

  // Handle Date objects - convert to ISO string
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // Handle ObjectId (Buffer) conversion
  if (
    obj &&
    typeof obj === "object" &&
    obj.constructor &&
    obj.constructor.name === "ObjectId"
  ) {
    return obj.toString();
  }

  // Handle Buffer conversion (for _id fields)
  if (
    obj &&
    typeof obj === "object" &&
    obj.constructor &&
    obj.constructor.name === "Buffer"
  ) {
    return obj.toString("hex");
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => normalizeObjectIds(item));
  }

  // Handle objects
  if (typeof obj === "object") {
    const normalized = {};
    for (const [key, value] of Object.entries(obj)) {
      normalized[key] = normalizeObjectIds(value);
    }
    return normalized;
  }

  return obj;
};

/**
 * Creates a deep immutable copy of an object with ObjectId normalization
 * Uses structuredClone for Node 18+ compatibility
 * @param {any} obj - The object to copy
 * @returns {any} Deep copy of the object with normalized ObjectIds
 */
export const deepImmutableCopy = (obj) => {
  if (obj === null || obj === undefined) return obj;

  try {
    // Use structuredClone for Node 18+ (faster and more reliable)
    const cloned = structuredClone(obj);
    return normalizeObjectIds(cloned);
  } catch (error) {
    // Fallback for older Node versions or unsupported types
    console.warn(
      "structuredClone not available, using JSON fallback:",
      error.message
    );
    const cloned = JSON.parse(JSON.stringify(obj));
    return normalizeObjectIds(cloned);
  }
};

/**
 * Creates a shallow immutable copy of an object
 * @param {any} obj - The object to copy
 * @returns {any} Shallow copy of the object
 */
export const shallowImmutableCopy = (obj) => {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return [...obj];
  }

  if (typeof obj === "object") {
    return { ...obj };
  }

  return obj;
};

/**
 * Creates an immutable copy of an array with mapped items and ObjectId normalization
 * Useful for arrays of objects that need deep copying
 * @param {Array} array - The array to copy
 * @param {Function} mapper - Optional mapper function for each item
 * @returns {Array} Immutable copy of the array with normalized ObjectIds
 */
export const immutableArrayCopy = (array, mapper = null) => {
  if (!Array.isArray(array)) return array;

  if (mapper) {
    return array.map((item) => normalizeObjectIds(mapper(item)));
  }

  return array.map((item) => deepImmutableCopy(item));
};

/**
 * Creates an immutable copy of a league with teams
 * Specialized function for league objects
 * @param {Object} league - The league object
 * @returns {Object} Immutable copy of the league
 */
export const immutableLeagueCopy = (league) => {
  if (!league) return league;

  return {
    ...league,
    ...(league.teams && {
      teams: immutableArrayCopy(league.teams),
    }),
  };
};

/**
 * Creates an immutable copy of a fixture with populated fields
 * Specialized function for fixture objects
 * @param {Object} fixture - The fixture object
 * @returns {Object} Immutable copy of the fixture
 */
export const immutableFixtureCopy = (fixture) => {
  if (!fixture) return fixture;

  return {
    ...fixture,
    ...(fixture.league && { league: deepImmutableCopy(fixture.league) }),
    ...(fixture.homeTeam && { homeTeam: deepImmutableCopy(fixture.homeTeam) }),
    ...(fixture.awayTeam && { awayTeam: deepImmutableCopy(fixture.awayTeam) }),
    ...(fixture.venue && { venue: deepImmutableCopy(fixture.venue) }),
  };
};

/**
 * MongoDB-specific utility functions
 */

/**
 * Normalizes MongoDB query results by converting ObjectIds to strings
 * This is especially useful for .lean() queries that return Buffer objects
 * @param {any} data - The data from MongoDB query
 * @returns {any} Normalized data with string ObjectIds
 */
export const normalizeMongoData = (data) => {
  if (!data) return data;

  // Handle arrays of documents
  if (Array.isArray(data)) {
    return data.map((doc) => normalizeObjectIds(doc));
  }

  // Handle single document
  return normalizeObjectIds(data);
};

/**
 * Creates an immutable copy of MongoDB data with ObjectId normalization
 * Combines deep copying with ObjectId string conversion
 * @param {any} data - The MongoDB data to copy
 * @returns {any} Immutable copy with normalized ObjectIds
 */
export const immutableMongoCopy = (data) => {
  if (!data) return data;

  // First normalize ObjectIds, then create immutable copy
  const normalized = normalizeMongoData(data);
  return deepImmutableCopy(normalized);
};
