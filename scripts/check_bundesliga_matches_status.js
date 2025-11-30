import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import FootballEvent from "../src/models/FootballEvent.js";
import League from "../src/models/League.js";
import Team from "../src/models/Team.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to JSON file
const JSON_FILE = path.resolve(
  __dirname,
  "../data/footballapi/league_78_from_next_week.json"
);

async function checkBundesligaMatches() {
  try {
    console.log("=".repeat(80));
    console.log("🔍 Checking Bundesliga matches in database");
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

    // Get all Bundesliga matches
    const allMatches = await FootballEvent.find({
      league: bundesliga._id,
    })
      .populate("homeTeam", "name name_en apiFootballId")
      .populate("awayTeam", "name name_en apiFootballId")
      .lean();

    console.log(`📊 Total Bundesliga matches in database: ${allMatches.length}\n`);

    // Count matches with/without API Football ID
    const withApiId = allMatches.filter(
      (m) => m.externalIds?.apiFootball
    ).length;
    const withoutApiId = allMatches.length - withApiId;

    console.log("=".repeat(80));
    console.log("📈 Statistics:");
    console.log("=".repeat(80));
    console.log(`Total matches: ${allMatches.length}`);
    console.log(`✅ With externalIds.apiFootball: ${withApiId} (${((withApiId / allMatches.length) * 100).toFixed(1)}%)`);
    console.log(`❌ Without externalIds.apiFootball: ${withoutApiId} (${((withoutApiId / allMatches.length) * 100).toFixed(1)}%)\n`);

    // Read JSON file
    if (!fs.existsSync(JSON_FILE)) {
      console.error(`❌ JSON file not found: ${JSON_FILE}`);
      process.exit(1);
    }

    const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));
    const jsonMatches = jsonData.matches || [];
    const jsonApiIds = new Set(jsonMatches.map((m) => m.apiFootballId));

    console.log(`📄 JSON file has ${jsonMatches.length} matches\n`);

    // Check which matches from DB have API IDs that match JSON
    const dbApiIds = new Set();
    allMatches.forEach((m) => {
      if (m.externalIds?.apiFootball) {
        dbApiIds.add(m.externalIds.apiFootball);
      }
    });

    const matchingIds = [...jsonApiIds].filter((id) => dbApiIds.has(id));
    const jsonOnlyIds = [...jsonApiIds].filter((id) => !dbApiIds.has(id));
    const dbOnlyIds = [...dbApiIds].filter((id) => !jsonApiIds.has(id));

    console.log("=".repeat(80));
    console.log("🔗 API ID Matching:");
    console.log("=".repeat(80));
    console.log(`Matches in JSON: ${jsonMatches.length}`);
    console.log(`Matches in DB with API ID: ${withApiId}`);
    console.log(`✅ Matching API IDs: ${matchingIds.length}`);
    console.log(`📄 Only in JSON: ${jsonOnlyIds.length}`);
    console.log(`💾 Only in DB: ${dbOnlyIds.length}\n`);

    // Try to find matches by teams and date (for matches without API ID)
    console.log("=".repeat(80));
    console.log("🔍 Checking matches without API ID - trying to match by teams+date:");
    console.log("=".repeat(80));
    console.log("");

    const matchesWithoutApiId = allMatches.filter(
      (m) => !m.externalIds?.apiFootball
    );

    let foundByTeamsDate = 0;
    const foundMatches = [];

    for (const jsonMatch of jsonMatches.slice(0, 50)) {
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

      if (homeTeam && awayTeam) {
        // Search for match by teams and date (±24 hours)
        const jsonDate = new Date(jsonMatch.date);
        const dateStart = new Date(jsonDate);
        dateStart.setHours(dateStart.getHours() - 24);
        const dateEnd = new Date(jsonDate);
        dateEnd.setHours(dateEnd.getHours() + 24);

        const dbMatch = await FootballEvent.findOne({
          $or: [
            { homeTeam: homeTeam._id, awayTeam: awayTeam._id },
            { homeTeam: awayTeam._id, awayTeam: homeTeam._id },
          ],
          date: { $gte: dateStart, $lte: dateEnd },
          league: bundesliga._id,
        })
          .populate("homeTeam", "name name_en")
          .populate("awayTeam", "name name_en")
          .lean();

        if (dbMatch && !dbMatch.externalIds?.apiFootball) {
          foundByTeamsDate++;
          foundMatches.push({
            json: {
              apiId: jsonMatch.apiFootballId,
              home: jsonMatch.homeTeam.name,
              away: jsonMatch.awayTeam.name,
              date: jsonMatch.date,
            },
            db: {
              id: dbMatch._id.toString(),
              home: dbMatch.homeTeam?.name_en || dbMatch.homeTeam?.name,
              away: dbMatch.awayTeam?.name_en || dbMatch.awayTeam?.name,
              date: dbMatch.date,
              hasApiId: !!dbMatch.externalIds?.apiFootball,
            },
          });
        }
      }
    }

    console.log(`✅ Found ${foundByTeamsDate} matches by teams+date (checked first 50 from JSON)\n`);

    if (foundMatches.length > 0) {
      console.log("📋 Sample matches found by teams+date (without API ID):\n");
      foundMatches.slice(0, 10).forEach((match, idx) => {
        console.log(`${idx + 1}. JSON API ID: ${match.json.apiId}`);
        console.log(`   JSON: ${match.json.home} vs ${match.json.away}`);
        console.log(`   DB:   ${match.db.home} vs ${match.db.away}`);
        console.log(`   DB Match ID: ${match.db.id}`);
        console.log(`   DB has API ID: ${match.db.hasApiId ? "Yes" : "No"}`);
        console.log("");
      });
    }

    // Show sample matches without API ID
    console.log("=".repeat(80));
    console.log("📋 Sample matches in DB without API ID:");
    console.log("=".repeat(80));
    matchesWithoutApiId.slice(0, 10).forEach((match, idx) => {
      console.log(
        `${idx + 1}. ${match.homeTeam?.name_en || match.homeTeam?.name || "N/A"} vs ${match.awayTeam?.name_en || match.awayTeam?.name || "N/A"}`
      );
      console.log(`   Date: ${new Date(match.date).toISOString().split("T")[0]}`);
      console.log(`   Match ID: ${match._id}`);
      console.log("");
    });

    // Show sample API IDs that are only in DB
    if (dbOnlyIds.length > 0) {
      console.log("=".repeat(80));
      console.log("📋 Sample API IDs only in DB (not in JSON):");
      console.log("=".repeat(80));
      dbOnlyIds.slice(0, 10).forEach((apiId, idx) => {
        const match = allMatches.find(
          (m) => m.externalIds?.apiFootball === apiId
        );
        if (match) {
          console.log(
            `${idx + 1}. API ID: ${apiId} - ${match.homeTeam?.name_en || match.homeTeam?.name || "N/A"} vs ${match.awayTeam?.name_en || match.awayTeam?.name || "N/A"}`
          );
          console.log(`   Date: ${new Date(match.date).toISOString().split("T")[0]}`);
        }
      });
      console.log("");
    }

    console.log("=".repeat(80));
    console.log("✅ Check complete!");
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

checkBundesligaMatches();




