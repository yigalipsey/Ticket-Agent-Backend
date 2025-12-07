import "dotenv/config";
import mongoose from "mongoose";
import cron from "node-cron";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sax from "sax";
import FootballEvent from "../models/FootballEvent.js";
import Supplier from "../models/Supplier.js";
import Offer from "../models/Offer.js";
import { logWithCheckpoint, logError } from "../utils/logger.js";
import { createOffer } from "../services/offer/mutations/createOffer.js";
import { updateOffer } from "../services/offer/mutations/updateOffer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Results directory
const RESULTS_DIR = path.join(__dirname, "../../data/p1/feedsResults");

// Ensure results directory exists
function ensureResultsDirectory() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

// Save worker results to file
function saveResults(result, error = null) {
  try {
    ensureResultsDirectory();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `p1_prices_result_${timestamp}.json`;
    const filepath = path.join(RESULTS_DIR, filename);

    const output = {
      timestamp: new Date().toISOString(),
      success: !error,
      ...(error
        ? { error: error.message, stack: error.stack }
        : {
            summary: {
              matchesProcessed: result.matchesProcessed,
              matchesMatched: result.matchesMatched,
              offersCreated: result.offersCreated,
              offersUpdated: result.offersUpdated,
              offersSkipped: result.offersSkipped,
              minPriceUpdates: result.minPriceUpdates,
              errors: result.errors,
              unmatchedMatchesCount: result.unmatchedMatchesCount,
            },
            unmatchedMatches: result.unmatchedMatches?.slice(0, 100) || [], // Save first 100 for reference
          }),
    };

    fs.writeFileSync(filepath, JSON.stringify(output, null, 2), "utf8");
    logWithCheckpoint(
      "info",
      "Worker results saved",
      "P1_XML_WORKER_RESULT_SAVED",
      { filepath }
    );
    return filepath;
  } catch (saveError) {
    logError(saveError, { operation: "saveResults" });
    return null;
  }
}

// Configuration
const P1_XML_URL =
  "https://feeds.performancehorizon.com/yigalipsey/1101l5925/36e68b7b500770cf7b8b7379ce094fca.xml";
const DATA_DIR = path.join(__dirname, "../../data/p1");
const FEEDS_DIR = path.join(DATA_DIR, "feeds");
const BRAND_MAPPING_FILE = path.join(
  DATA_DIR,
  "mapping/brand_to_team_mapping.json"
);
const AFFILIATE_LINK =
  "https://p1travel.prf.hn/click/camref:1100l5y3LS/creativeref:1011l96189/destination:";

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(FEEDS_DIR)) {
  fs.mkdirSync(FEEDS_DIR, { recursive: true });
}

class P1XmlPricesWorker {
  constructor() {
    this.isRunning = false;
    this.scheduledJob = null;
  }

  // Retry helper with exponential backoff
  async retryWithBackoff(
    fn,
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000
  ) {
    let lastError;
    let delay = initialDelayMs;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check if error is retryable (network errors, timeouts, 5xx errors)
        const isRetryable =
          error.code === "ECONNRESET" ||
          error.code === "ETIMEDOUT" ||
          error.code === "ENOTFOUND" ||
          error.code === "ECONNREFUSED" ||
          error.code === "EAI_AGAIN" ||
          (error.response && error.response.status >= 500) ||
          (error.response && error.response.status === 429);

        // If not retryable or last attempt, throw immediately
        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }

        // Log retry attempt
        logWithCheckpoint(
          "warn",
          `Retry attempt ${attempt + 1}/${maxRetries} after error`,
          "P1_XML_WORKER_RETRY",
          {
            attempt: attempt + 1,
            maxRetries,
            delayMs: delay,
            errorCode: error.code || error.response?.status,
            errorMessage: error.message,
          }
        );

        // Wait before retry with exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Increase delay for next retry (exponential backoff with jitter)
        delay = Math.min(
          delay * 2 + Math.random() * 1000, // Add jitter to avoid thundering herd
          maxDelayMs
        );
      }
    }

    throw lastError;
  }

  // Connect to MongoDB
  async connectToDatabase() {
    try {
      if (mongoose.connection.readyState === 1) {
        return; // Already connected
      }

      logWithCheckpoint("info", "Connecting to MongoDB", "P1_XML_WORKER_001");

      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 30000,
      });

      logWithCheckpoint(
        "info",
        "Successfully connected to MongoDB",
        "P1_XML_WORKER_002"
      );
    } catch (error) {
      logError(error, { operation: "connectToDatabase" });
      throw error;
    }
  }

  // Download XML file with retry logic
  async downloadXmlFile() {
    return this.retryWithBackoff(async () => {
      try {
        logWithCheckpoint(
          "info",
          "Downloading P1 XML file",
          "P1_XML_WORKER_003",
          { url: P1_XML_URL }
        );

        const response = await axios.get(P1_XML_URL, {
          timeout: 60000, // 60 seconds timeout
          responseType: "stream",
        });

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `p1_feed_${timestamp}.xml`;
        const filepath = path.join(FEEDS_DIR, filename);

        const writer = fs.createWriteStream(filepath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
          writer.on("finish", () => {
            logWithCheckpoint(
              "info",
              "XML file downloaded successfully",
              "P1_XML_WORKER_004",
              { filepath, filename }
            );
            resolve(filepath);
          });
          writer.on("error", (writeError) => {
            // Clean up partial file on write error
            fs.unlink(filepath, () => {});
            reject(writeError);
          });
          response.data.on("error", (streamError) => {
            // Clean up partial file on stream error
            writer.destroy();
            fs.unlink(filepath, () => {});
            reject(streamError);
          });
        });
      } catch (error) {
        logError(error, { operation: "downloadXmlFile", url: P1_XML_URL });
        throw error;
      }
    });
  }

  // Parse XML file using streaming SAX parser
  // Returns matchesMap directly (only cheapest offer per match, filtered by allowedBrands)
  async parseXmlFileStreaming(filepath, brandMapping) {
    return new Promise((resolve, reject) => {
      try {
        logWithCheckpoint(
          "info",
          "Parsing XML file with streaming parser",
          "P1_XML_WORKER_005",
          { filepath }
        );

        const { allowedBrands } = brandMapping;
        const matchesMap = new Map();
        let currentProduct = {};
        let currentTag = null;
        let currentText = "";
        let isInProduct = false;
        let productsProcessed = 0;
        let productsFiltered = 0;

        const parser = sax.createStream(true, {
          trim: true,
          normalize: true,
          lowercase: false,
        });

        parser.on("opentag", (node) => {
          // Reset text accumulator when opening a new tag
          currentText = "";
          currentTag = node.name;
          if (node.name === "product") {
            isInProduct = true;
            currentProduct = {};
          }
        });

        parser.on("text", (text) => {
          if (isInProduct && currentTag) {
            // Accumulate text content (may come in multiple chunks)
            currentText += text;
          }
        });

        parser.on("closetag", (tagName) => {
          if (tagName === "product") {
            isInProduct = false;
            productsProcessed++;

            // Early filtering: only process products with allowed brands
            if (
              !currentProduct.brand ||
              !allowedBrands.has(currentProduct.brand)
            ) {
              currentProduct = {};
              currentText = "";
              currentTag = null;
              return;
            }

            // Filter only football matches with required fields
            if (
              currentProduct.subcategories !== "football" ||
              !currentProduct.home_team_name ||
              !currentProduct.away_team_name ||
              !currentProduct.date_start ||
              !currentProduct.price
            ) {
              currentProduct = {};
              currentText = "";
              currentTag = null;
              return;
            }

            productsFiltered++;

            // Process match - keep only cheapest offer per match
            const matchKey = `${currentProduct.brand}|${currentProduct.home_team_name}|${currentProduct.away_team_name}|${currentProduct.date_start}`;
            const price = parseFloat(currentProduct.price);

            if (isNaN(price)) {
              currentProduct = {};
              currentText = "";
              currentTag = null;
              return;
            }

            const extraInfo = currentProduct.extraInfo || "";
            const isHospitality = extraInfo.includes(
              "Ticket type: Hospitality ticket"
            );

            // Extract URL from productURL
            let url = currentProduct.productURL || "";
            if (url && !url.includes("p1travel.prf.hn")) {
              url = `${AFFILIATE_LINK}${encodeURIComponent(url)}`;
            }

            if (!matchesMap.has(matchKey)) {
              matchesMap.set(matchKey, {
                brand: currentProduct.brand,
                homeTeam: currentProduct.home_team_name,
                awayTeam: currentProduct.away_team_name,
                date: currentProduct.date_start,
                minPrice: price,
                url: url,
                isHospitality: isHospitality,
                currency: "EUR", // P1 prices are in EUR
              });
            } else {
              // Keep the lowest price
              const existing = matchesMap.get(matchKey);
              if (price < existing.minPrice) {
                existing.minPrice = price;
                existing.url = url;
                existing.isHospitality = isHospitality;
              }
            }

            currentProduct = {};
            currentText = "";
            currentTag = null;
          } else if (isInProduct && currentTag === tagName) {
            // Store the accumulated text value for the current tag
            if (currentText.trim()) {
              currentProduct[tagName] = currentText.trim();
            }
            currentText = "";
            currentTag = null;
          } else {
            currentTag = null;
          }
        });

        parser.on("error", (error) => {
          logError(error, { operation: "parseXmlFileStreaming", filepath });
          reject(error);
        });

        parser.on("end", () => {
          logWithCheckpoint(
            "info",
            "XML file parsed successfully with streaming parser",
            "P1_XML_WORKER_006",
            {
              totalProductsProcessed: productsProcessed,
              productsFiltered: productsFiltered,
              uniqueMatches: matchesMap.size,
            }
          );
          resolve(Array.from(matchesMap.values()));
        });

        // Create read stream and pipe to parser
        const readStream = fs.createReadStream(filepath, { encoding: "utf8" });
        readStream.pipe(parser);

        readStream.on("error", (error) => {
          logError(error, { operation: "readXmlFileStream", filepath });
          reject(error);
        });
      } catch (error) {
        logError(error, { operation: "parseXmlFileStreaming", filepath });
        reject(error);
      }
    });
  }

  // Load brand mapping file
  loadBrandMapping() {
    try {
      if (!fs.existsSync(BRAND_MAPPING_FILE)) {
        throw new Error(`Brand mapping file not found: ${BRAND_MAPPING_FILE}`);
      }

      const mappingContent = fs.readFileSync(BRAND_MAPPING_FILE, "utf-8");
      const mapping = JSON.parse(mappingContent);

      // Create a map of brand -> teamId for quick lookup
      const brandToTeamMap = new Map();
      // Create a reverse map: team name (English) -> teamId for matching the other team
      const teamNameToTeamIdMap = new Map();
      const allowedBrands = new Set();
      const allowedLeagueIds = new Set();

      for (const league of mapping.leagues || []) {
        allowedLeagueIds.add(league.leagueId);

        for (const brandInfo of league.brands || []) {
          const brand = brandInfo.brand;
          allowedBrands.add(brand);

          if (!brandToTeamMap.has(brand)) {
            brandToTeamMap.set(brand, []);
          }
          brandToTeamMap.get(brand).push({
            teamId: brandInfo.teamId,
            teamName: brandInfo.teamName,
            leagueId: league.leagueId,
            leagueName: league.leagueName,
          });

          // Create reverse mapping: normalize brand name and map to teamId
          // This helps match the other team (home/away) from XML
          const normalizedBrand = this.normalizeTeamName(brand);
          if (!teamNameToTeamIdMap.has(normalizedBrand)) {
            teamNameToTeamIdMap.set(normalizedBrand, []);
          }
          teamNameToTeamIdMap.get(normalizedBrand).push({
            teamId: brandInfo.teamId,
            brand: brand,
            teamName: brandInfo.teamName,
          });
        }
      }

      logWithCheckpoint("info", "Brand mapping loaded", "P1_XML_WORKER_017", {
        totalLeagues: allowedLeagueIds.size,
        totalBrands: allowedBrands.size,
        mappingFile: BRAND_MAPPING_FILE,
      });

      return {
        allowedBrands,
        allowedLeagueIds: Array.from(allowedLeagueIds),
        brandToTeamMap,
        teamNameToTeamIdMap,
        mapping,
      };
    } catch (error) {
      logError(error, { operation: "loadBrandMapping" });
      throw error;
    }
  }

  // Extract match data from XML products
  extractMatchData(products, brandMapping) {
    const matchesMap = new Map();
    const { allowedBrands } = brandMapping;

    for (const product of products) {
      // Filter only football matches
      if (
        product.subcategories !== "football" ||
        !product.brand ||
        !product.home_team_name ||
        !product.away_team_name ||
        !product.date_start ||
        !product.price
      ) {
        continue;
      }

      // Filter by allowed brands only
      if (!allowedBrands.has(product.brand)) {
        continue;
      }

      const matchKey = `${product.brand}|${product.home_team_name}|${product.away_team_name}|${product.date_start}`;
      const price = parseFloat(product.price);
      const extraInfo = product.extraInfo || "";
      const isHospitality = extraInfo.includes(
        "Ticket type: Hospitality ticket"
      );

      // Extract URL from productURL
      // The productURL already contains the affiliate link from P1 XML feed
      let url = product.productURL || "";

      // If URL doesn't have affiliate link, build it
      if (url && !url.includes("p1travel.prf.hn")) {
        // Build affiliate link
        url = `${AFFILIATE_LINK}${encodeURIComponent(url)}`;
      }

      if (!matchesMap.has(matchKey)) {
        matchesMap.set(matchKey, {
          brand: product.brand,
          homeTeam: product.home_team_name,
          awayTeam: product.away_team_name,
          date: product.date_start,
          minPrice: price,
          url: url,
          isHospitality: isHospitality,
          currency: "EUR", // P1 prices are in EUR
        });
      } else {
        // Keep the lowest price
        const existing = matchesMap.get(matchKey);
        if (price < existing.minPrice) {
          existing.minPrice = price;
          existing.url = url;
          existing.isHospitality = isHospitality;
        }
      }
    }

    return Array.from(matchesMap.values());
  }

  // Normalize team name for matching
  normalizeTeamName(name) {
    if (!name) return "";
    return name
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\bfc\b/gi, "")
      .replace(/\bunited\b/gi, "")
      .replace(/\bcity\b/gi, "")
      .replace(/\bwanderers\b/gi, "")
      .replace(/\bhotspur\b/gi, "")
      .replace(/\b&/gi, "")
      .replace(/\s+/g, "")
      .trim();
  }

  // Match XML match to database fixture using brand mapping
  async matchToFixture(xmlMatch, brandMapping, debug = false) {
    try {
      const { brandToTeamMap, teamNameToTeamIdMap, allowedLeagueIds } =
        brandMapping;

      // Get team IDs for the brand
      const brandTeams = brandToTeamMap.get(xmlMatch.brand);
      if (!brandTeams || brandTeams.length === 0) {
        if (debug) {
          logWithCheckpoint(
            "info",
            "No brand teams found for brand",
            "P1_XML_WORKER_DEBUG_001",
            { brand: xmlMatch.brand }
          );
        }
        return null;
      }

      const xmlDate = new Date(xmlMatch.date);
      // Flexible date range: ±2 days to handle date discrepancies
      const startOfDay = new Date(xmlDate);
      startOfDay.setDate(startOfDay.getDate() - 2);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(xmlDate);
      endOfDay.setDate(endOfDay.getDate() + 2);
      endOfDay.setHours(23, 59, 59, 999);

      if (debug) {
        logWithCheckpoint(
          "info",
          "Matching XML match to fixture",
          "P1_XML_WORKER_DEBUG_002",
          {
            brand: xmlMatch.brand,
            homeTeam: xmlMatch.homeTeam,
            awayTeam: xmlMatch.awayTeam,
            date: xmlMatch.date,
            brandTeamsCount: brandTeams.length,
            dateRange: { start: startOfDay, end: endOfDay },
          }
        );
      }

      // Try to find the other team's teamId from XML names using reverse mapping
      const xmlHomeNormalized = this.normalizeTeamName(xmlMatch.homeTeam);
      const xmlAwayNormalized = this.normalizeTeamName(xmlMatch.awayTeam);
      const otherTeamIds = new Set();

      // Try to find teamId for home team from XML
      const homeTeamMatches = teamNameToTeamIdMap.get(xmlHomeNormalized) || [];
      for (const match of homeTeamMatches) {
        otherTeamIds.add(match.teamId);
      }

      // Try to find teamId for away team from XML
      const awayTeamMatches = teamNameToTeamIdMap.get(xmlAwayNormalized) || [];
      for (const match of awayTeamMatches) {
        otherTeamIds.add(match.teamId);
      }

      if (debug) {
        logWithCheckpoint(
          "info",
          "Found other team IDs from XML names",
          "P1_XML_WORKER_DEBUG_003",
          {
            xmlHomeTeam: xmlMatch.homeTeam,
            xmlAwayTeam: xmlMatch.awayTeam,
            xmlHomeNormalized,
            xmlAwayNormalized,
            homeTeamMatches: homeTeamMatches.length,
            awayTeamMatches: awayTeamMatches.length,
            otherTeamIds: Array.from(otherTeamIds),
          }
        );
      }

      // Try to find fixture for each team that matches this brand
      for (const brandTeam of brandTeams) {
        // Find fixtures where this team is home team and date matches
        // AND the away team matches one of the teamIds we found from XML
        let fixtures = await FootballEvent.find({
          date: { $gte: startOfDay, $lte: endOfDay },
          league: brandTeam.leagueId,
          homeTeam: brandTeam.teamId,
          awayTeam: { $in: Array.from(otherTeamIds) },
        })
          .populate("homeTeam", "name")
          .populate("awayTeam", "name")
          .lean();

        if (debug && fixtures.length > 0) {
          logWithCheckpoint(
            "info",
            "Found fixtures where brand team is home and away team matches",
            "P1_XML_WORKER_DEBUG_004",
            {
              brand: xmlMatch.brand,
              teamId: brandTeam.teamId,
              leagueId: brandTeam.leagueId,
              fixturesCount: fixtures.length,
              fixtures: fixtures.map((f) => ({
                id: f._id,
                homeTeam: f.homeTeam?.name,
                awayTeam: f.awayTeam?.name,
                date: f.date,
              })),
            }
          );
        }

        if (fixtures.length > 0) {
          // Found match! Return the first one (should be only one)
          return fixtures[0];
        }

        // Also check if this team is away team
        fixtures = await FootballEvent.find({
          date: { $gte: startOfDay, $lte: endOfDay },
          league: brandTeam.leagueId,
          awayTeam: brandTeam.teamId,
          homeTeam: { $in: Array.from(otherTeamIds) },
        })
          .populate("homeTeam", "name")
          .populate("awayTeam", "name")
          .lean();

        if (debug && fixtures.length > 0) {
          logWithCheckpoint(
            "info",
            "Found fixtures where brand team is away and home team matches",
            "P1_XML_WORKER_DEBUG_005",
            {
              brand: xmlMatch.brand,
              teamId: brandTeam.teamId,
              leagueId: brandTeam.leagueId,
              fixturesCount: fixtures.length,
              fixtures: fixtures.map((f) => ({
                id: f._id,
                homeTeam: f.homeTeam?.name,
                awayTeam: f.awayTeam?.name,
                date: f.date,
              })),
            }
          );
        }

        if (fixtures.length > 0) {
          // Found match! Return the first one (should be only one)
          return fixtures[0];
        }
      }

      if (debug) {
        logWithCheckpoint(
          "info",
          "No matching fixture found",
          "P1_XML_WORKER_DEBUG_007",
          {
            brand: xmlMatch.brand,
            homeTeam: xmlMatch.homeTeam,
            awayTeam: xmlMatch.awayTeam,
            date: xmlMatch.date,
          }
        );
      }

      return null;
    } catch (error) {
      logError(error, {
        operation: "matchToFixture",
        xmlMatch: `${xmlMatch.brand} - ${xmlMatch.homeTeam} vs ${xmlMatch.awayTeam}`,
      });
      return null;
    }
  }

  // Update prices for all fixtures
  async updatePrices() {
    if (this.isRunning) {
      logWithCheckpoint(
        "warn",
        "P1 XML price update already running, skipping",
        "P1_XML_WORKER_007"
      );
      return;
    }

    this.isRunning = true;

    try {
      logWithCheckpoint(
        "info",
        "Starting P1 XML price update",
        "P1_XML_WORKER_008"
      );

      // 1. Load brand mapping
      const brandMapping = this.loadBrandMapping();

      // 2. Download XML file
      const xmlFilepath = await this.downloadXmlFile();

      // 3. Parse XML file with streaming parser (filters by allowedBrands and keeps only cheapest per match)
      const xmlMatches = await this.parseXmlFileStreaming(
        xmlFilepath,
        brandMapping
      );

      logWithCheckpoint(
        "info",
        "Extracted matches from XML using streaming parser",
        "P1_XML_WORKER_009",
        { totalMatches: xmlMatches.length }
      );

      // 4. Get P1 supplier
      const p1Supplier = await Supplier.findOne({ slug: "p1-travel" });
      if (!p1Supplier) {
        throw new Error('Supplier "p1-travel" not found');
      }

      const stats = {
        matchesProcessed: 0,
        matchesMatched: 0,
        offersUpdated: 0,
        offersCreated: 0,
        offersSkipped: 0,
        errors: 0,
        minPriceUpdates: 0,
      };

      // Track matches that weren't found in DB
      const unmatchedMatches = [];

      // 5. Match and update prices
      // Debug first few matches to understand matching issues
      const debugFirstN = 5;
      for (let i = 0; i < xmlMatches.length; i++) {
        const xmlMatch = xmlMatches[i];
        try {
          stats.matchesProcessed++;

          const debug = i < debugFirstN;
          const fixture = await this.matchToFixture(
            xmlMatch,
            brandMapping,
            debug
          );

          if (!fixture) {
            // Track unmatched matches
            unmatchedMatches.push({
              brand: xmlMatch.brand,
              homeTeam: xmlMatch.homeTeam,
              awayTeam: xmlMatch.awayTeam,
              date: xmlMatch.date,
              price: xmlMatch.minPrice,
            });
            continue; // No matching fixture found
          }

          stats.matchesMatched++;

          // Find existing offer
          const existingOffer = await Offer.findOne({
            fixtureId: fixture._id,
            ownerType: "Supplier",
            ownerId: p1Supplier._id,
          }).lean();

          const offerData = {
            fixtureId: fixture._id,
            ownerType: "Supplier",
            ownerId: p1Supplier._id,
            price: xmlMatch.minPrice,
            currency: xmlMatch.currency,
            ticketType: "standard",
            isHospitality: xmlMatch.isHospitality,
            isAvailable: true,
            url: xmlMatch.url,
          };

          if (existingOffer) {
            // Update existing offer if price or other fields changed
            const needsUpdate =
              existingOffer.price !== offerData.price ||
              existingOffer.currency !== offerData.currency ||
              existingOffer.isHospitality !== offerData.isHospitality ||
              existingOffer.url !== offerData.url;

            if (needsUpdate) {
              // Use central update service (handles cache and minPrice automatically)
              const updatePayload = {
                price: offerData.price,
                currency: offerData.currency,
                isHospitality: offerData.isHospitality,
                isAvailable: offerData.isAvailable,
                url: offerData.url,
              };

              await updateOffer(existingOffer._id, updatePayload);
              stats.offersUpdated++;
              stats.minPriceUpdates++; // updateOffer handles minPrice update
            } else {
              stats.offersSkipped++;
            }
          } else {
            // Create new offer using central service (handles cache and minPrice automatically)
            await createOffer(offerData);
            stats.offersCreated++;
            stats.minPriceUpdates++; // createOffer handles minPrice update
          }
        } catch (error) {
          stats.errors++;
          logError(error, {
            operation: "updateMatchPrice",
            xmlMatch: `${xmlMatch.homeTeam} vs ${xmlMatch.awayTeam}`,
          });
        }
      }

      logWithCheckpoint(
        "info",
        "P1 XML price update completed",
        "P1_XML_WORKER_010",
        {
          ...stats,
          unmatchedMatchesCount: unmatchedMatches.length,
        }
      );

      // Log unmatched matches grouped by reason
      if (unmatchedMatches.length > 0) {
        logWithCheckpoint(
          "warn",
          "Matches from XML not found in database",
          "P1_XML_WORKER_011",
          {
            totalUnmatched: unmatchedMatches.length,
            unmatchedMatches: unmatchedMatches.slice(0, 50), // First 50 for logging
            // Group by brand to see which teams have most unmatched matches
            unmatchedByBrand: unmatchedMatches.reduce((acc, match) => {
              acc[match.brand] = (acc[match.brand] || 0) + 1;
              return acc;
            }, {}),
          }
        );

        // Also log to console for visibility
        console.log("\n⚠️  Matches not found in DB:");
        console.log(
          `Total: ${unmatchedMatches.length} out of ${stats.matchesProcessed}`
        );
        console.log("\nFirst 20 unmatched matches:");
        unmatchedMatches.slice(0, 20).forEach((match, idx) => {
          console.log(
            `${idx + 1}. ${match.brand} - ${match.homeTeam} vs ${
              match.awayTeam
            } (${match.date}) - €${match.price}`
          );
        });
        if (unmatchedMatches.length > 20) {
          console.log(`... and ${unmatchedMatches.length - 20} more`);
        }
      }

      return {
        ...stats,
        unmatchedMatches: unmatchedMatches,
        unmatchedMatchesCount: unmatchedMatches.length,
      };
    } catch (error) {
      logError(error, { operation: "updatePrices" });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // Schedule recurring update (runs every 3 days)
  start() {
    if (this.scheduledJob) {
      logWithCheckpoint(
        "warn",
        "P1 XML price update job already scheduled",
        "P1_XML_WORKER_011"
      );
      return;
    }

    // Cron expression: runs every 3 days at 2:00 AM
    // This means: every 3 days at 2:00 AM
    const cronExpression = "0 2 */3 * *";

    logWithCheckpoint(
      "info",
      "Scheduling P1 XML price update job",
      "P1_XML_WORKER_012",
      {
        cronExpression,
        schedule: "Every 3 days at 2:00 AM",
      }
    );

    this.scheduledJob = cron.schedule(
      cronExpression,
      async () => {
        try {
          await this.connectToDatabase();
          const result = await this.updatePrices();
          saveResults(result);
        } catch (error) {
          logError(error, { operation: "scheduledPriceUpdate" });
          saveResults(null, error);
        }
      },
      {
        scheduled: true,
        timezone: process.env.TZ || undefined,
      }
    );

    logWithCheckpoint(
      "info",
      "P1 XML price update job scheduled successfully",
      "P1_XML_WORKER_013",
      {
        cronExpression,
        nextRun: this.scheduledJob.nextDate(),
      }
    );
  }

  // Stop the scheduled job
  stop() {
    if (this.scheduledJob) {
      this.scheduledJob.stop();
      this.scheduledJob.destroy();
      this.scheduledJob = null;
      logWithCheckpoint(
        "info",
        "P1 XML price update job stopped",
        "P1_XML_WORKER_014"
      );
    }
  }

  // Get job status
  getStatus() {
    return {
      isRunning: this.isRunning,
      isScheduled: this.scheduledJob !== null,
      nextRun: this.scheduledJob?.nextDate() || null,
    };
  }
}

// Create worker instance
const p1XmlPricesWorker = new P1XmlPricesWorker();

// Handle uncaught exceptions - prevent worker crash
process.on("uncaughtException", (error) => {
  logError(error, {
    operation: "uncaughtException",
    worker: "p1XmlPricesWorker",
  });
  logWithCheckpoint(
    "error",
    "Uncaught exception in P1 XML prices worker - shutting down gracefully",
    "P1_XML_WORKER_017",
    { error: error.message }
  );
  // Stop the worker and exit
  try {
    p1XmlPricesWorker.stop();
  } catch (stopError) {
    logError(stopError, { operation: "stopWorkerOnError" });
  }
  process.exit(1);
});

// Handle unhandled promise rejections - prevent worker crash
process.on("unhandledRejection", (reason, promise) => {
  logError(new Error(`Unhandled Rejection at: ${promise}, reason: ${reason}`), {
    operation: "unhandledRejection",
    worker: "p1XmlPricesWorker",
  });
  logWithCheckpoint(
    "error",
    "Unhandled rejection in P1 XML prices worker",
    "P1_XML_WORKER_018",
    { reason: reason?.toString() || "Unknown" }
  );
  // Note: We don't exit on unhandled rejection to allow the worker to continue
  // but we log it for monitoring
});

// Handle process termination
process.on("SIGINT", async () => {
  logWithCheckpoint(
    "info",
    "Received SIGINT, shutting down P1 XML prices worker gracefully",
    "P1_XML_WORKER_015"
  );

  try {
    p1XmlPricesWorker.stop();
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(0);
  } catch (error) {
    logError(error, { operation: "gracefulShutdown" });
    process.exit(1);
  }
});

process.on("SIGTERM", async () => {
  logWithCheckpoint(
    "info",
    "Received SIGTERM, shutting down P1 XML prices worker gracefully",
    "P1_XML_WORKER_016"
  );

  try {
    p1XmlPricesWorker.stop();
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(0);
  } catch (error) {
    logError(error, { operation: "gracefulShutdown" });
    process.exit(1);
  }
});

// CLI interface for manual execution or starting the worker
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.includes("--start")) {
    // Start the worker with cron scheduling
    (async () => {
      try {
        await p1XmlPricesWorker.connectToDatabase();
        p1XmlPricesWorker.start();
        console.log("✅ P1 XML prices worker started and scheduled");
        console.log("📅 Schedule: Every 3 days at 2:00 AM");
        console.log(`⏰ Next run: ${p1XmlPricesWorker.getStatus().nextRun}`);
      } catch (error) {
        console.error("❌ Failed to start worker:", error);
        process.exit(1);
      }
    })();
  } else if (args.includes("--run-once")) {
    // Run once immediately (for testing)
    (async () => {
      try {
        await p1XmlPricesWorker.connectToDatabase();
        console.log("🏆 Updating P1 prices from XML...");
        const result = await p1XmlPricesWorker.updatePrices();

        const output = {
          success: true,
          summary: {
            matchesProcessed: result.matchesProcessed,
            matchesMatched: result.matchesMatched,
            offersCreated: result.offersCreated,
            offersUpdated: result.offersUpdated,
            offersSkipped: result.offersSkipped,
            minPriceUpdates: result.minPriceUpdates,
            errors: result.errors,
          },
        };

        console.log("\n" + JSON.stringify(output, null, 2));

        // Save results to file
        const savedPath = saveResults(result);
        if (savedPath) {
          console.log(`\n✅ Results saved to: ${savedPath}`);
        }

        await mongoose.disconnect();
        process.exit(0);
      } catch (error) {
        const errorOutput = {
          success: false,
          error: error.message,
          stack: error.stack,
        };
        console.error("\n" + JSON.stringify(errorOutput, null, 2));

        // Save error results to file
        const savedPath = saveResults(null, error);
        if (savedPath) {
          console.log(`\n⚠️ Error results saved to: ${savedPath}`);
        }

        process.exit(1);
      }
    })();
  } else {
    console.log("Usage:");
    console.log(
      "  --start     Start the P1 XML prices worker with cron scheduling"
    );
    console.log("  --run-once  Run P1 XML price update once (for testing)");
    process.exit(1);
  }
}

export default p1XmlPricesWorker;
