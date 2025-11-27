import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";
import Venue from "../src/models/Venue.js";
import League from "../src/models/League.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to JSON file
const JSON_FILE = path.resolve(
  __dirname,
  "../data/footballapi/league_2_from_next_week.json"
);

// Generate slug: homeTeamSlug-vs-awayTeamSlug-YYYY-MM-DD
function generateSlug(homeTeamSlug, awayTeamSlug, date) {
  const dateStr = new Date(date).toISOString().split("T")[0]; // YYYY-MM-DD
  return `${homeTeamSlug}-vs-${awayTeamSlug}-${dateStr}`;
}

// Format date for display
function formatDate(date) {
  if (!date) return "N/A";
  return new Date(date).toISOString().replace("T", " ").substring(0, 19);
}

async function fixMatches() {
  try {
    console.log("=".repeat(80));
    console.log("🔧 Fixing UEFA Champions League matches from API Football");
    console.log("=".repeat(80));
    console.log("");

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Find Champions League
    const championsLeague = await League.findOne({
      $or: [
        { slug: "champions-league" },
        { name: /champions.?league/i },
        { name: /uefa.?champions/i },
      ],
    });

    if (!championsLeague) {
      console.error("❌ Champions League not found in database");
      process.exit(1);
    }

    console.log(`✅ Found league: ${championsLeague.name} (ID: ${championsLeague._id})\n`);

    // Read JSON file
    if (!fs.existsSync(JSON_FILE)) {
      console.error(`❌ JSON file not found: ${JSON_FILE}`);
      process.exit(1);
    }

    const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));
    const jsonMatches = jsonData.matches || [];

    console.log(`📄 Loaded ${jsonMatches.length} matches from JSON file\n`);

    // Statistics
    const stats = {
      total: jsonMatches.length,
      fixed: 0,
      totalUpdated: 0,
      dateUpdated: 0,
      venueUpdated: 0,
      slugUpdated: 0,
      notFound: 0,
      teamNotFound: 0,
      errors: [],
    };

    // Venue ID mappings for known venue differences
    const venueIdMappings = {
      700: 20732,   // Allianz Arena -> Fußball Arena München
      19381: 20733, // Signal Iduna Park -> BVB Stadion Dortmund
      667: 12678,   // Orange Vélodrome -> Stade Orange Vélodrome
      10491: 20734, // Deutsche Bank Park -> Frankfurt Arena
      // Alphamega Stadium (19616) -> Stadio Stelios Kyriakides (7134) - need to check if this exists
    };

    // Process each match
    for (let i = 0; i < jsonMatches.length; i++) {
      const jsonMatch = jsonMatches[i];
      const apiFootballId = jsonMatch.apiFootballId;

      console.log(
        `[CHECKPOINT ${i + 1}] Processing ${i + 1}/${jsonMatches.length}: API ID ${apiFootballId} - ${jsonMatch.homeTeam.name} vs ${jsonMatch.awayTeam.name}`
      );

      try {
        // Find match in database by API Football ID first
        let dbMatch = await FootballEvent.findOne({
          "externalIds.apiFootball": apiFootballId,
        })
          .populate("homeTeam", "name name_en slug apiFootballId")
          .populate("awayTeam", "name name_en slug apiFootballId")
          .populate("venue", "name_en name_he externalIds venueId")
          .lean();

        if (!dbMatch) {
          // Try to find by teams and date (±1 day)
          const homeTeam = await Team.findOne({
            $or: [
              { apiFootballId: jsonMatch.homeTeam.id },
              { "externalIds.apiFootball": jsonMatch.homeTeam.id },
            ],
          }).lean();

          const awayTeam = await Team.findOne({
            $or: [
              { apiFootballId: jsonMatch.awayTeam.id },
              { "externalIds.apiFootball": jsonMatch.awayTeam.id },
            ],
          }).lean();

          if (!homeTeam || !awayTeam) {
            stats.teamNotFound++;
            stats.errors.push({
              apiFootballId,
              issue: "TEAM_NOT_FOUND",
              homeTeam: jsonMatch.homeTeam.name,
              awayTeam: jsonMatch.awayTeam.name,
            });
            console.log(
              `   ❌ Team not found: ${!homeTeam ? jsonMatch.homeTeam.name : jsonMatch.awayTeam.name}`
            );
            continue;
          }

          const jsonDate = new Date(jsonMatch.date);
          const dateStart = new Date(jsonDate);
          dateStart.setDate(dateStart.getDate() - 1);
          dateStart.setHours(0, 0, 0, 0);
          const dateEnd = new Date(jsonDate);
          dateEnd.setDate(dateEnd.getDate() + 1);
          dateEnd.setHours(23, 59, 59, 999);

          dbMatch = await FootballEvent.findOne({
            $or: [
              { homeTeam: homeTeam._id, awayTeam: awayTeam._id },
              { homeTeam: awayTeam._id, awayTeam: homeTeam._id },
            ],
            date: { $gte: dateStart, $lte: dateEnd },
            league: championsLeague._id,
          })
            .populate("homeTeam", "name name_en slug apiFootballId")
            .populate("awayTeam", "name name_en slug apiFootballId")
            .populate("venue", "name_en name_he externalIds venueId")
            .lean();
        }

        if (!dbMatch) {
          stats.notFound++;
          stats.errors.push({
            apiFootballId,
            issue: "NOT_FOUND",
            json: {
              home: jsonMatch.homeTeam.name,
              away: jsonMatch.awayTeam.name,
              date: jsonMatch.date,
            },
          });
          console.log(
            `   ❌ Match not found in database for ${jsonMatch.homeTeam.name} vs ${jsonMatch.awayTeam.name}`
          );
          continue;
        }

        const updateData = {};
        let needsSlugUpdate = false;

        // 1. Check and fix reversed teams
        const dbHomeTeamApiId =
          dbMatch.homeTeam?.apiFootballId ||
          dbMatch.homeTeam?.externalIds?.apiFootball;
        const dbAwayTeamApiId =
          dbMatch.awayTeam?.apiFootballId ||
          dbMatch.awayTeam?.externalIds?.apiFootball;

        const isReversed =
          dbHomeTeamApiId === jsonMatch.awayTeam.id &&
          dbAwayTeamApiId === jsonMatch.homeTeam.id;

        if (isReversed) {
          // Find teams to swap
          const homeTeam = await Team.findOne({
            $or: [
              { apiFootballId: jsonMatch.homeTeam.id },
              { "externalIds.apiFootball": jsonMatch.homeTeam.id },
            ],
          }).lean();
          const awayTeam = await Team.findOne({
            $or: [
              { apiFootballId: jsonMatch.awayTeam.id },
              { "externalIds.apiFootball": jsonMatch.awayTeam.id },
            ],
          }).lean();

          if (homeTeam && awayTeam) {
            updateData.homeTeam = homeTeam._id;
            updateData.awayTeam = awayTeam._id;
            console.log(`   🔄 Will fix reversed teams`);
            needsSlugUpdate = true;
            stats.fixed++;
          }
        }

        // 2. Update date if different (within 1 minute tolerance)
        const jsonDate = new Date(jsonMatch.date);
        const dbDate = new Date(dbMatch.date);
        if (Math.abs(jsonDate.getTime() - dbDate.getTime()) > 60000) {
          updateData.date = jsonDate;
          console.log(
            `   📅 Will update date: ${formatDate(dbDate)} → ${formatDate(jsonDate)}`
          );
          needsSlugUpdate = true;
          stats.dateUpdated++;
        }

        // 3. Update venue if different
        const jsonVenueId = jsonMatch.venue?.id;
        const dbVenueApiId =
          dbMatch.venue?.externalIds?.apiFootball || dbMatch.venue?.venueId;
        if (jsonVenueId && jsonVenueId !== dbVenueApiId) {
          // Try to find venue by API Football ID
          let newVenue = await Venue.findOne({
            $or: [
              { "externalIds.apiFootball": jsonVenueId },
              { venueId: jsonVenueId },
            ],
          }).lean();
          
          // If not found, try to map known venue IDs
          if (!newVenue && venueIdMappings[jsonVenueId]) {
            newVenue = await Venue.findOne({
              "externalIds.apiFootball": venueIdMappings[jsonVenueId],
            }).lean();
          }
          
          // Special case for Alphamega Stadium / Stadio Stelios Kyriakides
          if (!newVenue && jsonVenueId === 19616) {
            newVenue = await Venue.findOne({
              "externalIds.apiFootball": 7134,
            }).lean();
          }
          
          if (newVenue) {
            updateData.venue = newVenue._id;
            console.log(
              `   🏟️  Will update venue: ${dbMatch.venue?.name_en || "N/A"} → ${newVenue.name_en || jsonMatch.venue.name}`
            );
            stats.venueUpdated++;
          } else {
            console.log(
              `   ⚠️  Venue not found in DB: ${jsonMatch.venue.name} (ID: ${jsonVenueId})`
            );
          }
        }

        // 4. Ensure API Football ID is set
        if (!dbMatch.externalIds?.apiFootball) {
          updateData["externalIds.apiFootball"] = apiFootballId;
        }

        // 5. Update slug if needed
        const currentHomeTeamSlug = isReversed
          ? dbMatch.awayTeam.slug
          : dbMatch.homeTeam.slug;
        const currentAwayTeamSlug = isReversed
          ? dbMatch.homeTeam.slug
          : dbMatch.awayTeam.slug;
        const newDateForSlug = updateData.date || dbMatch.date;

        const expectedSlug = generateSlug(
          currentHomeTeamSlug,
          currentAwayTeamSlug,
          newDateForSlug
        );

        if (dbMatch.slug !== expectedSlug) {
          // Check if slug already exists for another match
          const existingWithSlug = await FootballEvent.findOne({
            slug: expectedSlug,
            _id: { $ne: dbMatch._id },
          }).lean();

          if (existingWithSlug) {
            console.log(
              `   ⚠️  Slug ${expectedSlug} already exists, skipping slug update`
            );
          } else {
            updateData.slug = expectedSlug;
            console.log(
              `   🔗 Will update slug: ${dbMatch.slug} → ${expectedSlug}`
            );
            needsSlugUpdate = true;
            stats.slugUpdated++;
          }
        }

        if (Object.keys(updateData).length > 0) {
          await FootballEvent.findByIdAndUpdate(dbMatch._id, updateData, {
            new: true,
            runValidators: true,
          });
          stats.totalUpdated++;
          console.log(`   ✅ Updated match ${dbMatch._id}`);
        } else {
          console.log(`   ⏭️  No updates needed`);
        }
      } catch (error) {
        console.error(`   ❌ Error processing match:`, error.message);
        stats.errors.push({
          apiFootballId,
          issue: "ERROR",
          error: error.message,
        });
      }
    }

    // Print summary report
    console.log("\n" + "=".repeat(80));
    console.log("📊 FIX SUMMARY");
    console.log("=".repeat(80));
    console.log(`Total matches processed: ${stats.total}`);
    console.log(`✅ Total updated: ${stats.totalUpdated}`);
    console.log(`🔄 Reversed teams fixed: ${stats.fixed}`);
    console.log(`📅 Dates updated: ${stats.dateUpdated}`);
    console.log(`🏟️  Venues updated: ${stats.venueUpdated}`);
    console.log(`🔗 Slugs updated: ${stats.slugUpdated}`);
    console.log(`❌ Not found: ${stats.notFound}`);
    console.log(`❌ Team not found: ${stats.teamNotFound}`);
    console.log(`❌ Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("⚠️  ERRORS:");
      console.log("=".repeat(80));
      stats.errors.slice(0, 20).forEach((error, idx) => {
        console.log(`${idx + 1}. API ID ${error.apiFootballId}: ${error.issue}`);
        if (error.homeTeam) {
          console.log(`   ${error.homeTeam} vs ${error.awayTeam}`);
        }
        if (error.error) {
          console.log(`   Error: ${error.error}`);
        }
      });
      if (stats.errors.length > 20) {
        console.log(`\n... and ${stats.errors.length - 20} more errors`);
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ Fix complete!");
    console.log("=".repeat(80));

    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  } catch (error) {
    console.error("\n❌ Error:", error);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

fixMatches();



