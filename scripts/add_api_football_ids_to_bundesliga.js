import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";
import League from "../src/models/League.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to JSON file
const JSON_FILE = path.resolve(
  __dirname,
  "../data/footballapi/league_78_from_next_week.json"
);

async function addApiFootballIds() {
  try {
    console.log("=".repeat(80));
    console.log("🔍 Adding API Football IDs to Bundesliga matches");
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
      updated: 0,
      alreadyHasId: 0,
      reversed: 0,
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
            missingTeam: !homeTeam ? jsonMatch.homeTeam.name : jsonMatch.awayTeam.name,
          });
          console.log(
            `   ❌ Team not found: ${!homeTeam ? jsonMatch.homeTeam.name : jsonMatch.awayTeam.name}`
          );
          continue;
        }

        // Search for match by teams and date (±24 hours)
        const jsonDate = new Date(jsonMatch.date);
        const dateStart = new Date(jsonDate);
        dateStart.setHours(dateStart.getHours() - 24);
        const dateEnd = new Date(jsonDate);
        dateEnd.setHours(dateEnd.getHours() + 24);

        // First check exact match (homeTeam = homeTeam, awayTeam = awayTeam)
        let dbMatch = await FootballEvent.findOne({
          homeTeam: homeTeam._id,
          awayTeam: awayTeam._id,
          date: { $gte: dateStart, $lte: dateEnd },
          league: bundesliga._id,
        }).lean();

        if (dbMatch) {
          // Check if already has API ID
          if (dbMatch.externalIds?.apiFootball) {
            if (dbMatch.externalIds.apiFootball === apiFootballId) {
              stats.alreadyHasId++;
              console.log(`   ✅ Already has correct API ID`);
            } else {
              stats.errors.push({
                apiFootballId,
                dbMatchId: dbMatch._id.toString(),
                issue: "DIFFERENT_API_ID",
                jsonApiId: apiFootballId,
                dbApiId: dbMatch.externalIds.apiFootball,
              });
              console.log(
                `   ⚠️  Has different API ID: ${dbMatch.externalIds.apiFootball} (not updating)`
              );
            }
            continue;
          }

          // Add API ID
          await FootballEvent.findByIdAndUpdate(dbMatch._id, {
            $set: {
              "externalIds.apiFootball": apiFootballId,
            },
          });

          stats.updated++;
          console.log(
            `   ✅ Added API ID ${apiFootballId} to match ${dbMatch._id}`
          );
        } else {
          // Check if reversed (homeTeam = awayTeam, awayTeam = homeTeam)
          const reversedMatch = await FootballEvent.findOne({
            homeTeam: awayTeam._id,
            awayTeam: homeTeam._id,
            date: { $gte: dateStart, $lte: dateEnd },
            league: bundesliga._id,
          })
            .populate("homeTeam", "name name_en")
            .populate("awayTeam", "name name_en")
            .lean();

          if (reversedMatch) {
            stats.reversed++;
            stats.errors.push({
              apiFootballId,
              dbMatchId: reversedMatch._id.toString(),
              issue: "REVERSED",
              json: {
                home: jsonMatch.homeTeam.name,
                away: jsonMatch.awayTeam.name,
              },
              db: {
                home:
                  reversedMatch.homeTeam?.name_en ||
                  reversedMatch.homeTeam?.name ||
                  "N/A",
                away:
                  reversedMatch.awayTeam?.name_en ||
                  reversedMatch.awayTeam?.name ||
                  "N/A",
              },
            });
            console.log(
              `   ⚠️  Match found but REVERSED - not adding API ID`
            );
            console.log(
              `      JSON: ${jsonMatch.homeTeam.name} vs ${jsonMatch.awayTeam.name}`
            );
            console.log(
              `      DB:   ${reversedMatch.homeTeam?.name_en || reversedMatch.homeTeam?.name || "N/A"} vs ${reversedMatch.awayTeam?.name_en || reversedMatch.awayTeam?.name || "N/A"}`
            );
          } else {
            stats.notFound++;
            stats.errors.push({
              apiFootballId,
              issue: "NOT_FOUND",
              homeTeam: jsonMatch.homeTeam.name,
              awayTeam: jsonMatch.awayTeam.name,
              date: jsonMatch.date,
            });
            console.log(`   ❌ Match not found in database`);
          }
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
    console.log(`✅ Updated (added API ID): ${stats.updated}`);
    console.log(`✅ Already has API ID: ${stats.alreadyHasId}`);
    console.log(`⚠️  Reversed (not updated): ${stats.reversed}`);
    console.log(`❌ Not found in database: ${stats.notFound}`);
    console.log(`❌ Team not found: ${stats.teamNotFound}`);
    console.log(`❌ Errors: ${stats.errors.filter((e) => e.issue === "ERROR").length}`);
    console.log("");

    // Save detailed report
    const reportFile = path.resolve(
      __dirname,
      "../data/footballapi/add_api_ids_report.json"
    );
    const report = {
      generated_at: new Date().toISOString(),
      summary: {
        total: stats.total,
        updated: stats.updated,
        alreadyHasId: stats.alreadyHasId,
        reversed: stats.reversed,
        notFound: stats.notFound,
        teamNotFound: stats.teamNotFound,
      },
      errors: stats.errors,
    };

    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), "utf8");
    console.log(`📄 Detailed report saved to: ${reportFile}\n`);

    // Show reversed matches
    if (stats.reversed > 0) {
      console.log("=".repeat(80));
      console.log("⚠️  REVERSED MATCHES (not updated):");
      console.log("=".repeat(80));
      const reversed = stats.errors.filter((e) => e.issue === "REVERSED");
      reversed.slice(0, 20).forEach((match, idx) => {
        console.log(`\n${idx + 1}. API ID: ${match.apiFootballId}`);
        console.log(`   DB Match ID: ${match.dbMatchId}`);
        console.log(`   JSON: ${match.json.home} vs ${match.json.away}`);
        console.log(`   DB:   ${match.db.home} vs ${match.db.away}`);
      });
      if (reversed.length > 20) {
        console.log(`\n... and ${reversed.length - 20} more reversed matches`);
      }
      console.log("");
    }

    // Show not found matches
    if (stats.notFound > 0) {
      console.log("=".repeat(80));
      console.log("❌ NOT FOUND MATCHES:");
      console.log("=".repeat(80));
      const notFound = stats.errors.filter((e) => e.issue === "NOT_FOUND");
      notFound.slice(0, 20).forEach((match, idx) => {
        console.log(
          `${idx + 1}. API ID: ${match.apiFootballId} - ${match.homeTeam} vs ${match.awayTeam} (${new Date(match.date).toISOString().split("T")[0]})`
        );
      });
      if (notFound.length > 20) {
        console.log(`\n... and ${notFound.length - 20} more not found matches`);
      }
      console.log("");
    }

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

addApiFootballIds();

