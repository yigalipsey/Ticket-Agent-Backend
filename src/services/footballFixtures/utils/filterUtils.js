import { logWithCheckpoint } from "../../../utils/logger.js";

/**
 * פילטר עיר - מסנן משחקים לפי עיר האצטדיון
 */
export const applyCityFilter = (fixtures, city) => {
  if (!city) return fixtures;

  const filtered = fixtures.filter(
    (fixture) =>
      fixture.venue?.city_he?.toLowerCase().includes(city.toLowerCase()) ||
      fixture.venue?.city?.toLowerCase().includes(city.toLowerCase())
  );

  logWithCheckpoint("debug", "Applied city filter", "FILTER_001", {
    city,
    originalCount: fixtures.length,
    filteredCount: filtered.length,
  });

  return filtered;
};

/**
 * פילטר משחקים עם הצעות - מסנן רק משחקים שיש להם minPrice
 */
export const applyHasOffersFilter = (fixtures, hasOffers) => {
  if (!hasOffers) return fixtures;

  const filtered = fixtures.filter(
    (fixture) => fixture.minPrice?.amount && fixture.minPrice.amount > 0
  );

  logWithCheckpoint("debug", "Applied hasOffers filter", "FILTER_002", {
    hasOffers,
    originalCount: fixtures.length,
    filteredCount: filtered.length,
  });

  return filtered;
};

/**
 * פילטר משחקים עתידיים - מסנן רק משחקים שעדיין לא התקיימו
 */
export const applyUpcomingFilter = (fixtures, upcoming) => {
  if (!upcoming) return fixtures;

  const now = new Date();
  const filtered = fixtures.filter((fixture) => new Date(fixture.date) >= now);

  logWithCheckpoint("debug", "Applied upcoming filter", "FILTER_003", {
    upcoming,
    originalCount: fixtures.length,
    filteredCount: filtered.length,
  });

  return filtered;
};

/**
 * בניית טווח תאריכים מחודש (YYYY-MM)
 */
export const buildDateRangeFromMonth = (month) => {
  if (!month) return null;

  const [year, monthNum] = month.split("-");
  const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
  const endDate = new Date(
    parseInt(year),
    parseInt(monthNum),
    0,
    23,
    59,
    59,
    999
  );

  logWithCheckpoint("debug", "Built date range from month", "FILTER_004", {
    month,
    startDate,
    endDate,
  });

  return { startDate, endDate };
};

/**
 * יישום כל הפילטרים על רשימת משחקים
 */
export const applyAllFilters = (fixtures, filters = {}) => {
  let filteredFixtures = [...fixtures];
  const { city, hasOffers, upcoming } = filters;

  // יישום פילטרים בסדר לוגי
  if (city) {
    filteredFixtures = applyCityFilter(filteredFixtures, city);
  }

  if (hasOffers === true || hasOffers === "true") {
    filteredFixtures = applyHasOffersFilter(filteredFixtures, true);
  }

  if (upcoming === true || upcoming === "true") {
    filteredFixtures = applyUpcomingFilter(filteredFixtures, true);
  }

  logWithCheckpoint("info", "Applied all filters", "FILTER_005", {
    originalCount: fixtures.length,
    filteredCount: filteredFixtures.length,
    filtersApplied: Object.keys(filters).filter(
      (key) => filters[key] !== undefined
    ),
  });

  return filteredFixtures;
};

/**
 * וולידציה של פורמט חודש
 */
export const validateMonthFormat = (month) => {
  if (!month) return false;
  return /^\d{4}-\d{2}$/.test(month);
};

/**
 * וולידציה של פרמטרים
 */
export const validateFilters = (filters) => {
  const errors = [];

  if (filters.month && !validateMonthFormat(filters.month)) {
    errors.push("Invalid month format. Use YYYY-MM");
  }

  if (filters.page && (isNaN(filters.page) || filters.page < 1)) {
    errors.push("Page must be a positive number");
  }

  if (
    filters.limit &&
    (isNaN(filters.limit) || filters.limit < 1 || filters.limit > 100)
  ) {
    errors.push("Limit must be between 1 and 100");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
