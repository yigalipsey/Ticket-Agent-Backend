import { logWithCheckpoint } from "../../../utils/logger.js";

// Build filter object for football events
export const buildFootballEventFilter = (query, baseFilter = {}) => {
  const filter = { ...baseFilter };
  
  const {
    league,
    season,
    teamId,
    venue,
    status,
    round,
    upcoming,
  } = query;

  // League filter
  if (league) {
    filter.league = league;
    logWithCheckpoint("debug", "Added league filter", "FILTER_001", { league });
  }

  // Season filter (using tags)
  if (season) {
    filter.tags = { $in: [season] };
    logWithCheckpoint("debug", "Added season filter", "FILTER_002", { season });
  }

  // Team filter (home or away)
  if (teamId) {
    filter.$or = [{ homeTeam: teamId }, { awayTeam: teamId }];
    logWithCheckpoint("debug", "Added team filter", "FILTER_003", { teamId });
  }

  // Venue filter
  if (venue) {
    filter.venue = venue;
    logWithCheckpoint("debug", "Added venue filter", "FILTER_004", { venue });
  }

  // Status filter
  if (status) {
    filter.status = status;
    logWithCheckpoint("debug", "Added status filter", "FILTER_005", { status });
  }

  // Round filter
  if (round) {
    filter.round = round;
    logWithCheckpoint("debug", "Added round filter", "FILTER_006", { round });
  }

  // Date filter (upcoming or past)
  if (upcoming === true || upcoming === "true") {
    filter.date = { $gte: new Date() };
    logWithCheckpoint("debug", "Added upcoming filter", "FILTER_007", { upcoming: true });
  } else if (upcoming === false || upcoming === "false") {
    filter.date = { $lt: new Date() };
    logWithCheckpoint("debug", "Added past filter", "FILTER_008", { upcoming: false });
  }

  return filter;
};

// Build sort object for football events
export const buildSortObject = (sortBy, sortOrder) => {
  const sort = {};
  sort[sortBy] = sortOrder === "desc" ? -1 : 1;
  return sort;
};

// Build pagination parameters
export const buildPaginationParams = (page, limit) => {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  return { skip, limit: parseInt(limit) };
};

// Build populate options for football events
export const buildPopulateOptions = (includeDetails = true) => {
  const basePopulate = [
    { path: "league", select: "name country logoUrl slug" },
    { path: "homeTeam", select: "name code slug logoUrl" },
    { path: "awayTeam", select: "name code slug logoUrl" },
    { path: "venue", select: "name city_en city_he capacity" },
  ];

  if (includeDetails) {
    return basePopulate;
  }

  // Minimal populate for list views
  return [
    { path: "league", select: "name slug" },
    { path: "homeTeam", select: "name code slug" },
    { path: "awayTeam", select: "name code slug" },
    { path: "venue", select: "name city_en city_he" },
  ];
};
