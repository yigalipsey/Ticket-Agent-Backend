import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FootballEvent from "../src/models/FootballEvent.js";
import League from "../src/models/League.js";
import Supplier from "../src/models/Supplier.js";
import Team from "../src/models/Team.js";
import Venue from "../src/models/Venue.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DRY_RUN = false; // Set to false to actually create matches

// Paths
const HELLOTICKETS_MATCHES_PATH = path.resolve(
  __dirname,
  "../data/hellotickets/bundesliga_matches_hellotickets.json"
);
const FOOTBALLAPI_MATCHES_PATH = path.resolve(
  __dirname,
  "../data/footballapi/bundesliga_matches.json"
);

// Affiliate parameters
const AFFILIATE_PARAMS = "?tap_a=141252-18675a&tap_s=8995852-00a564";

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined in .env");
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");
}

function generateSlug(homeTeamSlug, awayTeamSlug, date) {
  const dateStr = new Date(date).toISOString().split("T")[0]; // YYYY-MM-DD
  return `${homeTeamSlug}-vs-${awayTeamSlug}-${dateStr}`;
}

function loadHelloTicketsMatches() {
  if (!fs.existsSync(HELLOTICKETS_MATCHES_PATH)) {
    console.log("⚠️  HelloTickets matches file not found");
    return [];
  }
  const data = JSON.parse(fs.readFileSync(HELLOTICKETS_MATCHES_PATH, "utf8"));
  return data.matches || [];
}

function loadFootballApiMatches() {
  if (!fs.existsSync(FOOTBALLAPI_MATCHES_PATH)) {
    console.log("⚠️  FootballAPI matches file not found");
    return [];
  }
  const data = JSON.parse(fs.readFileSync(FOOTBALLAPI_MATCHES_PATH, "utf8"));
  return data.matches || [];
}

// Match HelloTickets matches with FootballAPI matches by teams and date
function matchWithFootballApi(htMatch, apiMatches) {
  const htDate = new Date(htMatch.dateTime);
  const htHomeTeamId = htMatch.homeTeam.hellotickets_id;
  const htAwayTeamId = htMatch.awayTeam.hellotickets_id;

  for (const apiMatch of apiMatches) {
    const apiDate = new Date(apiMatch.date);
    const dateDiff = Math.abs(apiDate.getTime() - htDate.getTime());
    const hoursDiff = dateDiff / (1000 * 60 * 60);

    // Match within 24 hours
    if (hoursDiff > 24) continue;

    // Match teams (need to check by team names or IDs)
    const apiHomeName = apiMatch.homeTeam.name.toLowerCase();
    const apiAwayName = apiMatch.awayTeam.name.toLowerCase();
    const htHomeName = htMatch.homeTeam.hellotickets_name.toLowerCase();
    const htAwayName = htMatch.awayTeam.hellotickets_name.toLowerCase();

    if (
      (apiHomeName.includes(htHomeName) || htHomeName.includes(apiHomeName)) &&
      (apiAwayName.includes(htAwayName) || htAwayName.includes(apiAwayName))
    ) {
      return apiMatch;
    }
  }

  return null;
}

async function createBundesligaMatches() {
  try {
    console.log(
      "================================================================================"
    );
    console.log("🔍 Creating Bundesliga matches");
    console.log(
      "================================================================================"
    );
    console.log("");

    // Load data
    const htMatches = loadHelloTicketsMatches();
    console.log(`📥 Loaded ${htMatches.length} matches from HelloTickets`);

    const apiMatches = loadFootballApiMatches();
    console.log(`📥 Loaded ${apiMatches.length} matches from FootballAPI\n`);

    // Get league
    const bundesliga = await League.findOne({ slug: "bundesliga" });
    if (!bundesliga) {
      throw new Error("Bundesliga league not found in database");
    }
    console.log(`✅ Found league: ${bundesliga.name} (${bundesliga._id})\n`);

    // Get HelloTickets supplier
    const supplier = await Supplier.findOne({ slug: "hellotickets" });
    if (!supplier) {
      throw new Error("HelloTickets supplier not found in database");
    }
    console.log(`✅ Found supplier: ${supplier.name} (${supplier._id})\n`);

    // Get all teams for quick lookup
    const teams = await Team.find({ leagueIds: bundesliga._id }).lean();
    const teamMap = new Map();
    teams.forEach((team) => {
      teamMap.set(team._id.toString(), team);
      teamMap.set(team.slug, team);
    });
    console.log(`✅ Loaded ${teams.length} teams for lookup\n`);

    // Get all venues for quick lookup
    const venues = await Venue.find({}).lean();
    const venueMap = new Map();
    venues.forEach((venue) => {
      venueMap.set(venue._id.toString(), venue);
      if (venue.externalIds?.apiFootball) {
        venueMap.set(`api:${venue.externalIds.apiFootball}`, venue);
      }
    });
    console.log(`✅ Loaded ${venues.length} venues for lookup\n`);

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    console.log(
      "================================================================================"
    );
    console.log("📋 Processing matches...");
    console.log(
      "================================================================================"
    );
    console.log("");

    for (let i = 0; i < htMatches.length; i++) {
      const htMatch = htMatches[i];
      const matchNum = i + 1;

      try {
        // Get teams
        const homeTeamId = htMatch.homeTeam.id;
        const awayTeamId = htMatch.awayTeam.id;

        if (!homeTeamId || !awayTeamId) {
          console.log(
            `[${matchNum}/${htMatches.length}] ⚠️  Skipping: Missing team IDs`
          );
          skippedCount++;
          continue;
        }

        const homeTeam = teamMap.get(homeTeamId);
        const awayTeam = teamMap.get(awayTeamId);

        if (!homeTeam || !awayTeam) {
          console.log(
            `[${matchNum}/${htMatches.length}] ⚠️  Skipping: Teams not found in DB`
          );
          skippedCount++;
          continue;
        }

        // Get venue (from home team)
        const venueId = homeTeam.venueId;
        if (!venueId) {
          console.log(
            `[${matchNum}/${htMatches.length}] ⚠️  Skipping: Home team has no venue`
          );
          skippedCount++;
          continue;
        }

        // venueId can be ObjectId or string
        const venueIdStr = venueId.toString ? venueId.toString() : venueId;
        const venue = venueMap.get(venueIdStr);
        if (!venue) {
          console.log(
            `[${matchNum}/${htMatches.length}] ⚠️  Skipping: Venue not found`
          );
          skippedCount++;
          continue;
        }

        // Generate slug
        const date = new Date(htMatch.dateTime);
        const slug = generateSlug(homeTeam.slug, awayTeam.slug, date);

        // Check if match already exists
        const existingMatch = await FootballEvent.findOne({ slug });

        // Match with FootballAPI for external ID
        const apiMatch = matchWithFootballApi(htMatch, apiMatches);
        const apiFootballId = apiMatch?.apiFootballId || null;

        // Prepare match data
        const matchData = {
          date: date,
          status: apiMatch?.status?.short || "NS", // Not Started
          league: bundesliga._id,
          homeTeam: homeTeam._id,
          awayTeam: awayTeam._id,
          venue: venue._id,
          round: apiMatch?.league?.round || null,
          roundNumber: null,
          slug: slug,
          tags: ["Bundesliga", "2025"],
          externalIds: apiFootballId
            ? {
                apiFootball: apiFootballId,
              }
            : {},
          supplierExternalIds: [
            {
              supplierRef: supplier._id,
              supplierExternalId: htMatch.htPerformanceId,
              metadata: new Map([
                ["url", htMatch.url],
                ["affiliateUrl", htMatch.affiliateUrl],
              ]),
            },
          ],
          minPrice: htMatch.priceRange.min_price
            ? {
                amount: htMatch.priceRange.min_price,
                currency: htMatch.priceRange.currency || "EUR",
                updatedAt: new Date(),
              }
            : null,
        };

        if (existingMatch) {
          // Update existing match
          if (DRY_RUN) {
            console.log(
              `[${matchNum}/${htMatches.length}] 🔄 Would update: ${slug}`
            );
          } else {
            // Update HelloTickets mapping if not exists
            const hasHtMapping = existingMatch.supplierExternalIds.some(
              (m) =>
                m.supplierRef.toString() === supplier._id.toString() &&
                m.supplierExternalId === htMatch.htPerformanceId
            );

            if (!hasHtMapping) {
              existingMatch.supplierExternalIds.push({
                supplierRef: supplier._id,
                supplierExternalId: htMatch.htPerformanceId,
                metadata: new Map([
                  ["url", htMatch.url],
                  ["affiliateUrl", htMatch.affiliateUrl],
                ]),
              });
            }

            // Update minPrice if better
            if (
              htMatch.priceRange.min_price &&
              (!existingMatch.minPrice?.amount ||
                htMatch.priceRange.min_price < existingMatch.minPrice.amount)
            ) {
              existingMatch.minPrice = {
                amount: htMatch.priceRange.min_price,
                currency: htMatch.priceRange.currency || "EUR",
                updatedAt: new Date(),
              };
            }

            // Update external ID if missing
            if (apiFootballId && !existingMatch.externalIds?.apiFootball) {
              existingMatch.externalIds = {
                ...existingMatch.externalIds,
                apiFootball: apiFootballId,
              };
            }

            await existingMatch.save();
            console.log(
              `[${matchNum}/${htMatches.length}] ✅ Updated: ${
                homeTeam.name_en || homeTeam.name
              } vs ${awayTeam.name_en || awayTeam.name} (${
                date.toISOString().split("T")[0]
              })`
            );
          }
          updatedCount++;
        } else {
          // Create new match
          if (DRY_RUN) {
            console.log(
              `[${matchNum}/${htMatches.length}] ➕ Would create: ${slug}`
            );
          } else {
            const newMatch = new FootballEvent(matchData);
            await newMatch.save();
            console.log(
              `[${matchNum}/${htMatches.length}] ✅ Created: ${
                homeTeam.name_en || homeTeam.name
              } vs ${awayTeam.name_en || awayTeam.name} (${
                date.toISOString().split("T")[0]
              })`
            );
          }
          createdCount++;
        }
      } catch (error) {
        const errorMsg = `Error processing match ${i + 1}: ${error.message}`;
        console.error(`[${matchNum}/${htMatches.length}] ❌ ${errorMsg}`);
        errors.push({
          matchIndex: i + 1,
          error: error.message,
        });
        skippedCount++;
      }
    }

    console.log("");
    console.log(
      "================================================================================"
    );
    console.log("📊 SUMMARY");
    console.log(
      "================================================================================"
    );
    console.log(`✅ Created: ${createdCount} matches`);
    console.log(`🔄 Updated: ${updatedCount} matches`);
    console.log(`⏭️  Skipped: ${skippedCount} matches`);
    if (errors.length > 0) {
      console.log(`❌ Errors: ${errors.length}`);
      console.log("\nError details:");
      errors.slice(0, 10).forEach((err) => {
        console.log(`   Match ${err.matchIndex}: ${err.error}`);
      });
    }
    console.log("");

    // Verification
    console.log(
      "================================================================================"
    );
    console.log("🔍 VERIFICATION");
    console.log(
      "================================================================================"
    );
    console.log("");

    const totalMatches = await FootballEvent.countDocuments({
      league: bundesliga._id,
    });
    console.log(`📊 Total Bundesliga matches in DB: ${totalMatches}`);

    const matchesWithHt = await FootballEvent.countDocuments({
      league: bundesliga._id,
      "supplierExternalIds.supplierRef": supplier._id,
    });
    console.log(`📊 Matches with HelloTickets mapping: ${matchesWithHt}`);

    const matchesWithPrice = await FootballEvent.countDocuments({
      league: bundesliga._id,
      "minPrice.amount": { $exists: true, $ne: null },
    });
    console.log(`📊 Matches with minPrice: ${matchesWithPrice}`);

    const matchesWithApiFootball = await FootballEvent.countDocuments({
      league: bundesliga._id,
      "externalIds.apiFootball": { $exists: true, $ne: null },
    });
    console.log(`📊 Matches with API-Football ID: ${matchesWithApiFootball}`);

    console.log("");
    console.log(
      "================================================================================"
    );
    console.log("✅ Done!");
    console.log(
      "================================================================================"
    );
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    throw error;
  }
}

async function run() {
  try {
    await connectDB();
    await createBundesligaMatches();
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

run();
