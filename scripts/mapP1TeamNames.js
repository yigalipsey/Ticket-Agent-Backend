import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Team from "../src/models/Team.js";
import League from "../src/models/League.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Leagues we have in our database
const LEAGUES_TO_MAP = [
  { slug: "bundesliga", name: "Bundesliga" },
  { slug: "serie-a", name: "Serie A" },
  { slug: "ligue-1", name: "Ligue 1" },
  { slug: "champions-league", name: "Champions League" },
];

// Load P1 teams from JSON
const p1MatchesPath = path.join(
  __dirname,
  "../data/p1/all_football_matches.json"
);
const p1Matches = JSON.parse(fs.readFileSync(p1MatchesPath, "utf-8"));

// Get P1 team names for our leagues
const p1LeagueNames = {
  bundesliga: "bundesliga 2025-2026",
  "serie a": "serie a 2025-2026",
  "ligue 1": "ligue 1 2025-2026",
  "champions league": "champions league 2025-2026",
};

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined");
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    const mapping = {
      bundesliga: [],
      "serie-a": [],
      "ligue-1": [],
      "champions-league": [],
    };

    const unmatchedP1Teams = {
      bundesliga: new Set(),
      "serie-a": new Set(),
      "ligue-1": new Set(),
      "champions-league": new Set(),
    };

    // Process each league
    for (const leagueInfo of LEAGUES_TO_MAP) {
      console.log(`\n📊 Processing ${leagueInfo.name}...`);
      console.log("=".repeat(60));

      // Find league in database
      const league = await League.findOne({
        $or: [
          { slug: leagueInfo.slug },
          { name: new RegExp(leagueInfo.name, "i") },
        ],
      });

      if (!league) {
        console.log(`⚠️  League "${leagueInfo.name}" not found in database`);
        continue;
      }

      console.log(`✅ Found league: ${league.name} (${league._id})\n`);

      // Get teams from database
      const dbTeams = await Team.find({ leagueIds: league._id })
        .select("name name_en code slug")
        .lean();

      console.log(`📋 Found ${dbTeams.length} teams in database\n`);

      // Get P1 teams for this league
      const p1LeagueKey = Object.keys(p1LeagueNames).find(
        (key) => key.toLowerCase() === leagueInfo.name.toLowerCase()
      );
      const p1LeagueName = p1LeagueKey ? p1LeagueNames[p1LeagueKey] : null;

      if (!p1LeagueName) {
        console.log(`⚠️  P1 league name not found for ${leagueInfo.name}`);
        continue;
      }

      const p1TeamsForLeague = new Set();
      p1Matches.matches
        .filter((m) => m.league === p1LeagueName)
        .forEach((m) => {
          p1TeamsForLeague.add(m.home_team_name);
          p1TeamsForLeague.add(m.away_team_name);
        });

      console.log(`📋 Found ${p1TeamsForLeague.size} unique teams in P1\n`);

      // Try to match teams
      for (const p1TeamName of p1TeamsForLeague) {
        let matched = false;

        // Try exact match with name_en
        let dbTeam = dbTeams.find(
          (t) =>
            (t.name_en || "").toLowerCase() === p1TeamName.toLowerCase() ||
            (t.name || "").toLowerCase() === p1TeamName.toLowerCase()
        );

        if (dbTeam) {
          mapping[leagueInfo.slug].push({
            db_name: dbTeam.name_en || dbTeam.name,
            db_name_he: dbTeam.name || "",
            db_code: dbTeam.code,
            p1_name: p1TeamName,
            match_type: "exact",
          });
          matched = true;
          continue;
        }

        // Try partial match (remove common suffixes)
        const cleanP1Name = p1TeamName
          .replace(
            /\s*(FC|United|City|Hotspur|Wanderers|Albion|CF|AC|AS|OSC|SC)$/i,
            ""
          )
          .trim();

        dbTeam = dbTeams.find((t) => {
          const dbName = (t.name_en || t.name || "").toLowerCase();
          const cleanDbName = dbName
            .replace(
              /\s*(fc|united|city|hotspur|wanderers|albion|cf|ac|as|osc|sc)$/i,
              ""
            )
            .trim();
          return (
            dbName.includes(cleanP1Name.toLowerCase()) ||
            cleanP1Name.toLowerCase().includes(cleanDbName) ||
            cleanDbName === cleanP1Name.toLowerCase()
          );
        });

        if (dbTeam) {
          mapping[leagueInfo.slug].push({
            db_name: dbTeam.name_en || dbTeam.name,
            db_name_he: dbTeam.name || "",
            db_code: dbTeam.code,
            p1_name: p1TeamName,
            match_type: "partial",
          });
          matched = true;
          continue;
        }

        // Try matching by removing numbers and special chars
        const normalizedP1 = p1TeamName
          .replace(/[0-9]/g, "")
          .replace(/[^a-zA-Z\s]/g, "")
          .trim()
          .toLowerCase();

        dbTeam = dbTeams.find((t) => {
          const dbName = (t.name_en || t.name || "")
            .replace(/[0-9]/g, "")
            .replace(/[^a-zA-Z\s]/g, "")
            .trim()
            .toLowerCase();
          return (
            dbName === normalizedP1 ||
            dbName.includes(normalizedP1) ||
            normalizedP1.includes(dbName)
          );
        });

        if (dbTeam) {
          mapping[leagueInfo.slug].push({
            db_name: dbTeam.name_en || dbTeam.name,
            db_name_he: dbTeam.name || "",
            db_code: dbTeam.code,
            p1_name: p1TeamName,
            match_type: "normalized",
          });
          matched = true;
          continue;
        }

        // Try matching by city/location name (e.g., "Bayer 04 Leverkusen" -> "Bayer Leverkusen")
        const cityMatch = p1TeamName.match(
          /(\w+\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)$/
        );
        if (cityMatch) {
          const cityName = cityMatch[2].toLowerCase();
          dbTeam = dbTeams.find((t) => {
            const dbName = (t.name_en || t.name || "").toLowerCase();
            return (
              dbName.includes(cityName) ||
              cityName.includes(dbName.split(" ").pop() || "")
            );
          });

          if (dbTeam) {
            mapping[leagueInfo.slug].push({
              db_name: dbTeam.name_en || dbTeam.name,
              db_name_he: dbTeam.name || "",
              db_code: dbTeam.code,
              p1_name: p1TeamName,
              match_type: "city_match",
            });
            matched = true;
            continue;
          }
        }

        // Manual mappings for known mismatches
        const manualMappings = {
          "Bayer 04 Leverkusen": "Bayer Leverkusen",
          "Sport-Club Freiburg": "SC Freiburg",
          "Werden Bremen": "Werder Bremen", // Typo in P1
        };

        if (manualMappings[p1TeamName]) {
          dbTeam = dbTeams.find(
            (t) =>
              (t.name_en || t.name || "").toLowerCase() ===
              manualMappings[p1TeamName].toLowerCase()
          );

          if (dbTeam) {
            mapping[leagueInfo.slug].push({
              db_name: dbTeam.name_en || dbTeam.name,
              db_name_he: dbTeam.name || "",
              db_code: dbTeam.code,
              p1_name: p1TeamName,
              match_type: "manual",
            });
            matched = true;
            continue;
          }
        }

        // No match found
        if (!matched) {
          unmatchedP1Teams[leagueInfo.slug].add(p1TeamName);
        }
      }

      console.log(`✅ Matched: ${mapping[leagueInfo.slug].length} teams`);
      console.log(
        `⚠️  Unmatched: ${unmatchedP1Teams[leagueInfo.slug].size} teams`
      );
    }

    // Save mapping to file
    const outputDir = path.join(__dirname, "../data/p1");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const output = {
      generated_at: new Date().toISOString(),
      mappings: mapping,
      unmatched: Object.fromEntries(
        Object.entries(unmatchedP1Teams).map(([key, set]) => [
          key,
          Array.from(set).sort(),
        ])
      ),
      summary: {
        total_matched: Object.values(mapping).reduce(
          (sum, arr) => sum + arr.length,
          0
        ),
        total_unmatched: Object.values(unmatchedP1Teams).reduce(
          (sum, set) => sum + set.size,
          0
        ),
        by_league: Object.entries(mapping).map(([league, matches]) => ({
          league,
          matched: matches.length,
          unmatched: unmatchedP1Teams[league].size,
        })),
      },
    };

    const outputPath = path.join(outputDir, "team_name_mapping.json");
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");

    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total matched: ${output.summary.total_matched}`);
    console.log(`Total unmatched: ${output.summary.total_unmatched}`);
    console.log("\nBy League:");
    output.summary.by_league.forEach(({ league, matched, unmatched }) => {
      console.log(`  ${league}: ${matched} matched, ${unmatched} unmatched`);
    });

    console.log(`\n✅ Mapping saved to: ${outputPath}`);

    // Print unmatched teams
    console.log("\n⚠️  UNMATCHED TEAMS:");
    console.log("=".repeat(60));
    Object.entries(unmatchedP1Teams).forEach(([league, teams]) => {
      if (teams.size > 0) {
        console.log(`\n${league.toUpperCase()}:`);
        Array.from(teams)
          .sort()
          .forEach((team) => console.log(`  - ${team}`));
      }
    });
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
