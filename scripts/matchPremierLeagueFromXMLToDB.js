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

const JSON_FILE = path.join(
  __dirname,
  "../data/p1/premier_league_matches_from_xml.json"
);

async function normalizeTeamName(name) {
  if (!name) return "";
  // Remove common suffixes
  return name
    .replace(/\s*FC\s*$/i, "")
    .replace(/\s*United\s*$/i, "")
    .replace(/\s*City\s*$/i, "")
    .replace(/\s*Wanderers\s*$/i, "")
    .replace(/\s*Hotspur\s*$/i, "")
    .trim();
}

async function findTeam(teamName, leagueId) {
  if (!teamName) return null;

  // Try exact match first
  let team = await Team.findOne({
    $or: [
      { name_en: teamName },
      { "suppliersInfo.supplierTeamName": teamName },
    ],
    leagueIds: leagueId,
  }).lean();

  if (team) return team;

  // Try normalized name
  const normalized = await normalizeTeamName(teamName);
  if (normalized && normalized !== teamName) {
    team = await Team.findOne({
      $or: [
        { name_en: new RegExp(`^${normalized}$`, "i") },
        { name_en: new RegExp(normalized, "i") },
      ],
      leagueIds: leagueId,
    }).lean();
  }

  if (team) return team;

  // Try with FC added
  const withFC = `${teamName} FC`;
  team = await Team.findOne({
    $or: [
      { name_en: withFC },
      { name_en: new RegExp(`^${teamName}\\s*FC$`, "i") },
    ],
    leagueIds: leagueId,
  }).lean();

  if (team) return team;

  // Try without FC if it exists
  const withoutFC = teamName.replace(/\s*FC\s*$/i, "").trim();
  if (withoutFC !== teamName) {
    team = await Team.findOne({
      $or: [
        { name_en: withoutFC },
        { name_en: new RegExp(`^${withoutFC}$`, "i") },
      ],
      leagueIds: leagueId,
    }).lean();
  }

  if (team) return team;

  // Try partial match
  team = await Team.findOne({
    name_en: new RegExp(teamName.replace(/FC|United|City/g, "").trim(), "i"),
    leagueIds: leagueId,
  }).lean();

  return team;
}

async function findFixture(homeTeam, awayTeam, date, leagueId) {
  const matchDate = new Date(date + "T00:00:00Z");
  const startDate = new Date(matchDate);
  startDate.setDate(startDate.getDate() - 3);
  const endDate = new Date(matchDate);
  endDate.setDate(endDate.getDate() + 3);

  // Try normal order
  let fixture = await FootballEvent.findOne({
    league: leagueId,
    homeTeam: homeTeam._id,
    awayTeam: awayTeam._id,
    date: { $gte: startDate, $lte: endDate },
  })
    .populate("homeTeam", "name_en")
    .populate("awayTeam", "name_en")
    .lean();

  if (fixture) return fixture;

  // Try reversed order
  fixture = await FootballEvent.findOne({
    league: leagueId,
    homeTeam: awayTeam._id,
    awayTeam: homeTeam._id,
    date: { $gte: startDate, $lte: endDate },
  })
    .populate("homeTeam", "name_en")
    .populate("awayTeam", "name_en")
    .lean();

  return fixture;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    // Load JSON file
    const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, "utf-8"));
    const matches = jsonData.matches || [];
    console.log(`📖 Loaded ${matches.length} matches from JSON file\n`);

    // Find Premier League
    const premierLeague = await League.findOne({
      $or: [{ name: "Premier League" }, { slug: "premier-league" }],
    }).lean();

    if (!premierLeague) {
      console.error("❌ Premier League not found in database");
      return;
    }

    console.log(`🏆 League: ${premierLeague.name} (ID: ${premierLeague._id})\n`);

    const results = {
      found: [],
      notFound: [],
      teamsNotFound: [],
    };

    console.log("=".repeat(80));
    console.log("Matching matches to database...");
    console.log("=".repeat(80));

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const homeTeamName = match.homeTeam;
      const awayTeamName = match.awayTeam;
      const date = match.date;

      // Find teams
      const homeTeam = await findTeam(homeTeamName, premierLeague._id);
      const awayTeam = await findTeam(awayTeamName, premierLeague._id);

      if (!homeTeam || !awayTeam) {
        results.teamsNotFound.push({
          match: `${homeTeamName} vs ${awayTeamName} (${date})`,
          missingHome: !homeTeam ? homeTeamName : null,
          missingAway: !awayTeam ? awayTeamName : null,
        });
        continue;
      }

      // Find fixture
      const fixture = await findFixture(
        homeTeam,
        awayTeam,
        date,
        premierLeague._id
      );

      if (fixture) {
        results.found.push({
          xmlMatch: `${homeTeamName} vs ${awayTeamName} (${date})`,
          dbMatch: `${fixture.homeTeam.name_en} vs ${fixture.awayTeam.name_en} (${new Date(fixture.date).toISOString().split("T")[0]})`,
          fixtureId: fixture._id.toString(),
          date: date,
          price: match.minPrice,
        });
      } else {
        results.notFound.push({
          match: `${homeTeamName} vs ${awayTeamName} (${date})`,
          homeTeamDB: homeTeam.name_en,
          awayTeamDB: awayTeam.name_en,
          date: date,
          price: match.minPrice,
        });
      }

      if ((i + 1) % 20 === 0) {
        console.log(`Processed ${i + 1}/${matches.length} matches...`);
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("RESULTS:");
    console.log("=".repeat(80));
    console.log(`✅ Found in DB: ${results.found.length}`);
    console.log(`❌ Not found in DB: ${results.notFound.length}`);
    console.log(`⚠️  Teams not found: ${results.teamsNotFound.length}\n`);

    // Save results
    const outputFile = path.join(
      __dirname,
      "../data/p1/premier_league_matching_results.json"
    );
    fs.writeFileSync(
      outputFile,
      JSON.stringify(results, null, 2)
    );
    console.log(`💾 Results saved to: ${outputFile}\n`);

    // Show sample of not found
    if (results.notFound.length > 0) {
      console.log("=".repeat(80));
      console.log("Sample of matches NOT found in DB:");
      console.log("=".repeat(80));
      results.notFound.slice(0, 10).forEach((m, i) => {
        console.log(
          `${i + 1}. ${m.match}\n   DB Teams: ${m.homeTeamDB} vs ${m.awayTeamDB}`
        );
      });
      if (results.notFound.length > 10) {
        console.log(`\n... and ${results.notFound.length - 10} more`);
      }
    }

    // Show sample of teams not found
    if (results.teamsNotFound.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("Teams NOT found in DB:");
      console.log("=".repeat(80));
      results.teamsNotFound.slice(0, 10).forEach((t, i) => {
        console.log(
          `${i + 1}. ${t.match}\n   Missing: ${t.missingHome || ""} ${t.missingAway || ""}`
        );
      });
      if (results.teamsNotFound.length > 10) {
        console.log(`\n... and ${results.teamsNotFound.length - 10} more`);
      }
    }
  } catch (error) {
    console.error("❌ Error:", error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});




