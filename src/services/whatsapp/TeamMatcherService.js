import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Team from "../../models/Team.js";
import { logWithCheckpoint, logError } from "../../utils/logger.js";
import mongoose from "mongoose";

// ANSI color codes for colored console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

const logColor = (color, label, message, data = null) => {
  console.log(
    `${colors.dim}[TEAM MATCHER]${colors.reset} ${color}${colors.bright}${label}${colors.reset} ${color}${message}${colors.reset}`
  );
  if (data) {
    console.log(
      `${colors.dim}  →${colors.reset}`,
      JSON.stringify(data, null, 2)
    );
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for team aliases
let teamAliasesCache = null;

/**
 * Load team aliases from JSON file
 */
const loadTeamAliases = async () => {
  if (teamAliasesCache) {
    return teamAliasesCache;
  }

  try {
    const filePath = join(__dirname, "../../../data/teams/team_aliases.json");
    const fileContent = await readFile(filePath, "utf-8");
    teamAliasesCache = JSON.parse(fileContent);
    logWithCheckpoint("info", "Team aliases loaded", "TEAM_MATCHER_001", {
      teamsCount: teamAliasesCache.length,
    });
    return teamAliasesCache;
  } catch (error) {
    logError(error, { operation: "loadTeamAliases" });
    throw new Error("Failed to load team aliases");
  }
};

/**
 * Normalize text for matching (remove diacritics, lowercase, trim)
 * Handles Hebrew text normalization including apostrophes and common typos
 */
const normalizeText = (text) => {
  if (!text) return "";
  return (
    text
      .trim()
      .toLowerCase()
      // Remove Hebrew apostrophes (גרש) - both ' and ׳
      .replace(/['׳]/g, "")
      // Remove English quotes
      .replace(/[""]/g, "")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      // Remove common Hebrew diacritics that might cause issues
      .replace(/[\u0591-\u05C7]/g, "")
  );
};

/**
 * Calculate similarity score between two strings using Levenshtein distance
 * Returns a score between 0 and 1, where 1 is an exact match
 */
const calculateSimilarity = (str1, str2) => {
  const normalized1 = normalizeText(str1);
  const normalized2 = normalizeText(str2);

  // Exact match after normalization
  if (normalized1 === normalized2) return 1.0;

  // Check if one contains the other (substring match)
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    const longer =
      normalized1.length > normalized2.length ? normalized1 : normalized2;
    const shorter =
      normalized1.length > normalized2.length ? normalized2 : normalized1;
    // Higher score for longer substring matches
    return 0.7 + (shorter.length / longer.length) * 0.2;
  }

  // Calculate Levenshtein distance
  const longer =
    normalized1.length > normalized2.length ? normalized1 : normalized2;
  const shorter =
    normalized1.length > normalized2.length ? normalized2 : normalized1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(normalized1, normalized2);

  // Calculate similarity: 1 - (editDistance / maxLength)
  // This gives better scores for shorter strings with small differences
  const similarity = 1 - editDistance / longer.length;

  // Boost score for very short strings (common team name abbreviations)
  if (longer.length <= 4 && editDistance <= 1) {
    return Math.max(similarity, 0.7);
  }

  return similarity;
};

/**
 * Calculate Levenshtein distance between two strings
 */
const levenshteinDistance = (str1, str2) => {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
};

/**
 * Find team by text match (exact or fuzzy)
 * Returns match and suggestions sorted by similarity
 */
const findTeamByTextWithSuggestions = async (text, aliases) => {
  const normalizedText = normalizeText(text);

  // Track all matches with scores
  const allMatches = [];

  // First try exact match
  for (const team of aliases) {
    // Check name_he
    const nameScore =
      normalizeText(team.name_he) === normalizedText
        ? 1.0
        : calculateSimilarity(team.name_he, text);
    allMatches.push({
      team,
      score: nameScore,
      matchedText: team.name_he,
      type: "name_he",
    });

    if (nameScore === 1.0) {
      // Exact match found, return immediately
      return {
        match: team,
        suggestions: [team.name_he],
      };
    }

    // Check aliases
    for (const alias of team.aliases || []) {
      const normalizedAlias = normalizeText(alias);
      let aliasScore;

      if (normalizedAlias === normalizedText) {
        // Exact match - highest priority
        aliasScore = 1.0;
      } else if (
        normalizedText.includes(normalizedAlias) ||
        normalizedAlias.includes(normalizedText)
      ) {
        // Substring match - high priority (e.g., "ריאל" matches "ריאל מדריד")
        aliasScore = Math.max(0.9, calculateSimilarity(alias, text));
      } else {
        aliasScore = calculateSimilarity(alias, text);
      }

      allMatches.push({
        team,
        score: aliasScore,
        matchedText: alias,
        type: "alias",
      });

      if (aliasScore === 1.0) {
        // Exact match found in alias
        return {
          match: team,
          suggestions: [team.name_he],
        };
      }
    }
  }

  // Sort all matches by score (highest first)
  allMatches.sort((a, b) => b.score - a.score);

  // Find best match (threshold: 0.6)
  const bestMatch = allMatches.find((m) => m.score >= 0.6);

  // Get top 5 suggestions (unique team names)
  const suggestionsMap = new Map();
  for (const match of allMatches.slice(0, 10)) {
    if (!suggestionsMap.has(match.team.name_he) && match.score >= 0.4) {
      suggestionsMap.set(match.team.name_he, match.score);
    }
  }

  const suggestions = Array.from(suggestionsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  // Log fuzzy match results for debugging
  if (bestMatch) {
    logColor(colors.green, "✅ [MATCH FOUND]", `Found match for "${text}"`, {
      input: text,
      matched: bestMatch.team.name_he,
      score: bestMatch.score.toFixed(3),
      matchType: bestMatch.type,
      matchedText: bestMatch.matchedText,
      teamId: bestMatch.team.id,
      teamSlug: bestMatch.team.slug,
      topMatches: allMatches.slice(0, 3).map((m) => ({
        team: m.team.name_he,
        matchedText: m.matchedText,
        score: m.score.toFixed(3),
        type: m.type,
      })),
    });
  } else {
    logColor(colors.yellow, "⚠️  [NO MATCH]", `No match found for "${text}"`, {
      input: text,
      threshold: 0.6,
      topMatches: allMatches.slice(0, 5).map((m) => ({
        team: m.team.name_he,
        matchedText: m.matchedText,
        score: m.score.toFixed(3),
        type: m.type,
      })),
    });
  }

  return {
    match: bestMatch ? bestMatch.team : null,
    suggestions:
      suggestions.length > 0
        ? suggestions
        : allMatches.slice(0, 5).map((m) => m.team.name_he),
  };
};

/**
 * Extract team names from natural language query
 * Cleans common phrases before extracting team names
 */
const extractTeamNames = (query) => {
  const normalizedQuery = normalizeText(query);

  // Common phrases to remove before extracting team names
  const commonPhrases = [
    /תמצא\s+לי\s+כרטסים?\s+ל?/gi,
    /תמצא\s+כרטסים?\s+ל?/gi,
    /כרטסים?\s+ל?/gi,
    /תמצא\s+לי\s+ל?/gi,
    /תמצא\s+ל?/gi,
    /אני\s+רוצה\s+כרטסים?\s+ל?/gi,
    /רוצה\s+כרטסים?\s+ל?/gi,
    /אני\s+מחפש\s+כרטסים?\s+ל?/gi,
    /מחפש\s+כרטסים?\s+ל?/gi,
    /אני\s+צריך\s+כרטסים?\s+ל?/gi,
    /צריך\s+כרטסים?\s+ל?/gi,
    /בוא\s+תמצא\s+לי\s+כרטסים?\s+ל?/gi,
    /תראה\s+לי\s+כרטסים?\s+ל?/gi,
    /תראה\s+כרטסים?\s+ל?/gi,
  ];

  // Clean the query from common phrases
  let cleanedQuery = normalizedQuery;
  for (const phrase of commonPhrases) {
    cleanedQuery = cleanedQuery.replace(phrase, "").trim();
  }

  logColor(
    colors.yellow,
    "🧹 [CLEANING]",
    "Cleaned query from common phrases",
    {
      original: query,
      normalized: normalizedQuery,
      cleaned: cleanedQuery,
    }
  );

  // Common separators in Hebrew
  const separators = [
    " נגד ",
    " vs ",
    " מול ",
    " עם ",
    " נגד",
    " vs",
    " מול",
    " עם",
  ];

  for (const separator of separators) {
    if (cleanedQuery.includes(separator)) {
      const parts = cleanedQuery.split(separator);
      if (parts.length === 2) {
        const team1 = parts[0].trim();
        const team2 = parts[1].trim();

        // Additional cleaning: remove common words that might be left
        const team1Cleaned = team1
          .replace(/^ל\s+/, "") // Remove leading "ל"
          .replace(/\s+ל$/, "") // Remove trailing "ל"
          .trim();
        const team2Cleaned = team2
          .replace(/^ל\s+/, "") // Remove leading "ל"
          .replace(/\s+ל$/, "") // Remove trailing "ל"
          .trim();

        if (team1Cleaned && team2Cleaned) {
          return {
            team1: team1Cleaned,
            team2: team2Cleaned,
          };
        }
      }
    }
  }

  // Try to find two words/phrases (simple heuristic)
  const words = cleanedQuery.split(/\s+/).filter((w) => w.length > 0);
  if (words.length >= 2) {
    // Try different splits
    for (let i = 1; i < words.length; i++) {
      const team1 = words.slice(0, i).join(" ");
      const team2 = words.slice(i).join(" ");
      return { team1, team2 };
    }
  }

  return null;
};

/**
 * Match teams from natural language query
 * @param {string} query - Natural language query (e.g., "סיטי נגד יונייטד")
 * @returns {Object} - { team1: ObjectId, team2: ObjectId, team1Name: string, team2Name: string }
 */
export const matchTeamsFromQuery = async (query) => {
  try {
    logWithCheckpoint(
      "info",
      "Starting team matching from query",
      "TEAM_MATCHER_002",
      { query }
    );

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return {
        success: false,
        error: "Query is required",
      };
    }

    // Load aliases
    const aliases = await loadTeamAliases();

    // Extract team names from query
    const teamNames = extractTeamNames(query);

    if (!teamNames) {
      logWithCheckpoint(
        "warn",
        "Could not extract team names from query",
        "TEAM_MATCHER_003",
        { query }
      );
      return {
        success: false,
        error: "Could not identify two teams in the query",
      };
    }

    logColor(
      colors.cyan,
      "📝 [EXTRACTED]",
      "Extracted team names from query:",
      {
        team1: teamNames.team1,
        team2: teamNames.team2,
        originalQuery: query,
      }
    );

    // Find teams
    logColor(
      colors.blue,
      "🔍 [SEARCHING]",
      `Searching for team: "${teamNames.team1}"`
    );
    const team1Result = await findTeamByTextWithSuggestions(
      teamNames.team1,
      aliases
    );

    logColor(
      colors.blue,
      "🔍 [SEARCHING]",
      `Searching for team: "${teamNames.team2}"`
    );
    const team2Result = await findTeamByTextWithSuggestions(
      teamNames.team2,
      aliases
    );

    if (!team1Result.match) {
      logWithCheckpoint("warn", "Team not found", "TEAM_MATCHER_006", {
        query: teamNames.team1,
        suggestions: team1Result.suggestions,
      });
      return {
        success: false,
        error: `Could not find team: ${teamNames.team1}`,
        suggestions: team1Result.suggestions,
      };
    }

    if (!team2Result.match) {
      logWithCheckpoint("warn", "Team not found", "TEAM_MATCHER_007", {
        query: teamNames.team2,
        suggestions: team2Result.suggestions,
      });
      return {
        success: false,
        error: `Could not find team: ${teamNames.team2}`,
        suggestions: team2Result.suggestions,
      };
    }

    const team1 = team1Result.match;
    const team2 = team2Result.match;

    logColor(colors.green, "✅ [BOTH TEAMS FOUND]", "Both teams matched:", {
      team1: {
        name: team1.name_he,
        slug: team1.slug,
        id: team1.id,
      },
      team2: {
        name: team2.name_he,
        slug: team2.slug,
        id: team2.id,
      },
    });

    // Verify teams exist in database and get ObjectIds
    logColor(colors.blue, "🔍 [VERIFYING]", "Verifying teams in database...");
    const team1Doc = await Team.findOne({ slug: team1.slug })
      .select("_id name slug")
      .lean();
    const team2Doc = await Team.findOne({ slug: team2.slug })
      .select("_id name slug")
      .lean();

    if (!team1Doc) {
      return {
        success: false,
        error: `Team not found in database: ${team1.name_he}`,
      };
    }

    if (!team2Doc) {
      return {
        success: false,
        error: `Team not found in database: ${team2.name_he}`,
      };
    }

    logColor(colors.green, "✅ [VERIFIED]", "Teams verified in database:", {
      team1: {
        name: team1Doc.name,
        slug: team1Doc.slug,
        id: team1Doc._id.toString(),
      },
      team2: {
        name: team2Doc.name,
        slug: team2Doc.slug,
        id: team2Doc._id.toString(),
      },
    });

    return {
      success: true,
      team1: {
        _id: team1Doc._id,
        name: team1Doc.name,
        slug: team1Doc.slug,
      },
      team2: {
        _id: team2Doc._id,
        name: team2Doc.name,
        slug: team2Doc.slug,
      },
    };
  } catch (error) {
    logError(error, { operation: "matchTeamsFromQuery", query });
    return {
      success: false,
      error: error.message || "Failed to match teams",
    };
  }
};
