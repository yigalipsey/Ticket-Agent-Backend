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
  "../data/footballapi/league_78_from_next_week.json"
);

// Generate slug: homeTeamSlug-vs-awayTeamSlug-YYYY-MM-DD
function generateSlug(homeTeamSlug, awayTeamSlug, date) {
  const dateStr = new Date(date).toISOString().split("T")[0]; // YYYY-MM-DD
  return `${homeTeamSlug}-vs-${awayTeamSlug}-${dateStr}`;
}

async function fixMatches() {
  try {
    console.log("=".repeat(80));
    console.log("🔧 Fixing Bundesliga matches from API Football");
    console.log("=".repeat(80));
    console.log("");

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Find Bundesliga league
    const bundesliga = await League.findOne({
      $or: [{ slug: "bundesliga" }, { name: /bundesliga/i }],
    });

    if (!bundesliga) {
      console.error("❌ Bundesliga league not found in database");
      process.exit(1);
    }

    console.log(`✅ Found league: ${bundesliga.name} (ID: ${bundesliga._id})\n`);

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
      updated: 0,
      dateUpdated: 0,
      venueUpdated: 0,
      slugUpdated: 0,
      notFound: 0,
      teamNotFound: 0,
      errors: [],
    };

    // Process each match
    for (let i = 0; i < jsonMatches.length; i++) {
      const jsonMatch = jsonMatches[i];
      const apiFootballId = jsonMatch.apiFootballId;

      console.log(
        `[CHECKPOINT ${i + 1}] Processing ${i + 1}/${jsonMatches.length}: API ID ${apiFootballId} - ${jsonMatch.homeTeam.name} vs ${jsonMatch.awayTeam.name}`
      );

      try {
        // Find teams by API Football ID
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

        // Search for match by teams and date (±48 hours to catch date differences)
        const jsonDate = new Date(jsonMatch.date);
        const dateStart = new Date(jsonDate);
        dateStart.setHours(dateStart.getHours() - 48);
        const dateEnd = new Date(jsonDate);
        dateEnd.setHours(dateEnd.getHours() + 48);

        // First check exact match (homeTeam = homeTeam, awayTeam = awayTeam)
        let dbMatch = await FootballEvent.findOne({
          homeTeam: homeTeam._id,
          awayTeam: awayTeam._id,
          date: { $gte: dateStart, $lte: dateEnd },
          league: bundesliga._id,
        })
          .populate("venue", "externalIds venueId")
          .lean();

        let isReversed = false;

        // If not found, check if reversed
        if (!dbMatch) {
          dbMatch = await FootballEvent.findOne({
            homeTeam: awayTeam._id,
            awayTeam: homeTeam._id,
            date: { $gte: dateStart, $lte: dateEnd },
            league: bundesliga._id,
          })
            .populate("venue", "externalIds venueId")
            .lean();

          if (dbMatch) {
            isReversed = true;
          }
        }

        if (!dbMatch) {
          stats.notFound++;
          stats.errors.push({
            apiFootballId,
            issue: "NOT_FOUND",
            homeTeam: jsonMatch.homeTeam.name,
            awayTeam: jsonMatch.awayTeam.name,
            date: jsonMatch.date,
          });
          console.log(`   ❌ Match not found in database`);
          continue;
        }

        // Prepare update data
        const updateData = {};
        let needsUpdate = false;

        // 1. Fix reversed teams
        if (isReversed) {
          updateData.homeTeam = homeTeam._id;
          updateData.awayTeam = awayTeam._id;
          needsUpdate = true;
          stats.fixed++;
          console.log(`   🔄 Will fix reversed teams`);
        }

        // 2. Update date
        const dbDate = new Date(dbMatch.date);
        const jsonDateObj = new Date(jsonMatch.date);
        const dateDiff = Math.abs(dbDate.getTime() - jsonDateObj.getTime());
        if (dateDiff > 60000) {
          // More than 1 minute difference
          updateData.date = jsonDateObj;
          needsUpdate = true;
          stats.dateUpdated++;
          console.log(
            `   📅 Will update date: ${dbDate.toISOString().split("T")[0]} → ${jsonDateObj.toISOString().split("T")[0]}`
          );
        }

        // 3. Update venue
        const jsonVenueId = jsonMatch.venue.id;
        if (jsonVenueId) {
          const dbVenue = await Venue.findOne({
            $or: [
              { "externalIds.apiFootball": jsonVenueId },
              { venueId: jsonVenueId },
            ],
          }).lean();

          if (dbVenue) {
            const currentVenueId = dbMatch.venue?._id?.toString();
            const newVenueId = dbVenue._id.toString();

            if (currentVenueId !== newVenueId) {
              updateData.venue = dbVenue._id;
              needsUpdate = true;
              stats.venueUpdated++;
              console.log(
                `   🏟️  Will update venue: ${dbMatch.venue?.name_en || "N/A"} → ${dbVenue.name_en}`
              );
            }
          }
        }

        // 4. Update API ID if missing
        if (!dbMatch.externalIds?.apiFootball) {
          updateData["externalIds.apiFootball"] = apiFootballId;
          needsUpdate = true;
        }

        // 5. Generate new slug if teams or date changed
        if (isReversed || updateData.date) {
          const newSlug = generateSlug(
            homeTeam.slug,
            awayTeam.slug,
            updateData.date || jsonDateObj
          );

          // Check if new slug already exists
          const existingWithSlug = await FootballEvent.findOne({
            slug: newSlug,
            _id: { $ne: dbMatch._id },
          }).lean();

          if (existingWithSlug) {
            console.log(
              `   ⚠️  New slug ${newSlug} already exists, skipping slug update`
            );
          } else {
            updateData.slug = newSlug;
            needsUpdate = true;
            stats.slugUpdated++;
            console.log(
              `   🔗 Will update slug: ${dbMatch.slug} → ${newSlug}`
            );
          }
        }

        // Update match if needed
        if (needsUpdate) {
          await FootballEvent.findByIdAndUpdate(dbMatch._id, {
            $set: updateData,
          });

          stats.updated++;
          console.log(`   ✅ Updated match ${dbMatch._id}`);
        } else {
          console.log(`   ⏭️  No updates needed`);
        }
      } catch (error) {
        stats.errors.push({
          apiFootballId,
          issue: "ERROR",
          error: error.message,
        });
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // Print summary report
    console.log("\n" + "=".repeat(80));
    console.log("📊 SUMMARY REPORT");
    console.log("=".repeat(80));
    console.log(`Total matches in JSON: ${stats.total}`);
    console.log(`✅ Fixed (reversed teams): ${stats.fixed}`);
    console.log(`📅 Date updated: ${stats.dateUpdated}`);
    console.log(`🏟️  Venue updated: ${stats.venueUpdated}`);
    console.log(`🔗 Slug updated: ${stats.slugUpdated}`);
    console.log(`✅ Total updated: ${stats.updated}`);
    console.log(`❌ Not found: ${stats.notFound}`);
    console.log(`❌ Team not found: ${stats.teamNotFound}`);
    console.log(`❌ Errors: ${stats.errors.filter((e) => e.issue === "ERROR").length}`);
    console.log("");

    // Save detailed report
    const reportFile = path.resolve(
      __dirname,
      "../data/footballapi/fix_matches_report.json"
    );
    const report = {
      generated_at: new Date().toISOString(),
      summary: stats,
      errors: stats.errors,
    };

    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), "utf8");
    console.log(`📄 Detailed report saved to: ${reportFile}\n`);

    console.log("=".repeat(80));
    console.log("✅ Process complete!");
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



