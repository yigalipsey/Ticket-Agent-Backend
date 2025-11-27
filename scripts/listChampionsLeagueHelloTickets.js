import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Team from "../src/models/Team.js";
import Supplier from "../src/models/Supplier.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const CHAMPIONS_LEAGUE_TEAMS_PATH = path.resolve(
  __dirname,
  "../data/champions-league-teams.json"
);
const PERFORMERS_CSV_PATH = path.resolve(
  __dirname,
  "../data/performers_sports.csv"
);

// Champions League ID
const CHAMPIONS_LEAGUE_ID = "68e257c87413ca349124a5e3";

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined in .env");
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB");
}

function loadPerformersCSV() {
  const csvContent = fs.readFileSync(PERFORMERS_CSV_PATH, "utf8");
  const lines = csvContent.trim().split("\n");
  const performers = {};

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line (handling quoted fields)
    const match = line.match(/^(\d+),"([^"]*(?:""[^"]*)*)",(\d+),/);
    if (match) {
      const id = match[1];
      const name = match[2].replace(/""/g, '"');
      performers[name] = id;
    }
  }

  return performers;
}

function findHelloTicketsId(teamName, performersMap) {
  // Try exact match first
  if (performersMap[teamName]) {
    return performersMap[teamName];
  }

  // Try common variations
  const variations = [
    teamName,
    `${teamName} FC`,
    `${teamName} CF`,
    teamName.replace(/ FC$/, ""),
    teamName.replace(/ CF$/, ""),
    teamName.replace(/ Club$/, ""),
  ];

  for (const variation of variations) {
    // Try exact match
    if (performersMap[variation]) {
      return performersMap[variation];
    }

    // Try case-insensitive match
    for (const [htName, htId] of Object.entries(performersMap)) {
      if (htName.toLowerCase() === variation.toLowerCase()) {
        return htId;
      }
    }

    // Try partial match (contains)
    for (const [htName, htId] of Object.entries(performersMap)) {
      if (
        htName.toLowerCase().includes(variation.toLowerCase()) ||
        variation.toLowerCase().includes(htName.toLowerCase())
      ) {
        return htId;
      }
    }
  }

  return null;
}

// Mapping of known team names to Hello Tickets names
const KNOWN_MAPPINGS = {
  Barcelona: "FC Barcelona",
  "Real Madrid": "Real Madrid CF",
  "Atletico Madrid": "Atletico de Madrid",
  "Athletic Club": "Athletic Club",
  Villarreal: "Villarreal CF",
  Arsenal: "Arsenal FC",
  Liverpool: "Liverpool FC",
  "Manchester City": "Manchester City FC",
  Chelsea: "Chelsea FC",
  Tottenham: "Tottenham Hotspur FC",
  Newcastle: "Newcastle United FC",
  "Paris Saint Germain": "Paris Saint-Germain",
  Inter: "Inter Milan",
  Napoli: "SSC Napoli",
  "PSV Eindhoven": "PSV Eindhoven",
  "FC Copenhagen": "FC Copenhagen",
  Monaco: "AS Monaco",
  Benfica: "SL Benfica",
  Ajax: "AFC Ajax",
  "Club Brugge KV": "Club Brugge",
  "Sporting CP": "Sporting CP",
  Marseille: "Olympique de Marseille",
  Juventus: "Juventus FC",
  Atalanta: "Atalanta BC",
  Galatasaray: "Galatasaray SK",
};

async function run() {
  try {
    await connectDB();

    // 1. Load Champions League teams from JSON
    const clTeamsData = JSON.parse(
      fs.readFileSync(CHAMPIONS_LEAGUE_TEAMS_PATH, "utf8")
    );
    console.log(
      `📋 Loaded ${clTeamsData.teams.length} teams from Champions League JSON\n`
    );

    // 2. Load Hello Tickets performers
    console.log("📥 Loading Hello Tickets performers from CSV...");
    const performersMap = loadPerformersCSV();
    console.log(`✅ Loaded ${Object.keys(performersMap).length} performers\n`);

    // 3. Find Hello Tickets supplier
    const supplier = await Supplier.findOne({ slug: "hellotickets" });
    if (!supplier) {
      throw new Error("Hello Tickets supplier not found in database");
    }
    console.log(`✅ Found supplier: ${supplier.name} (${supplier._id})\n`);

    // 4. Process each team
    const results = [];

    for (const teamJson of clTeamsData.teams) {
      const team = await Team.findOne({ slug: teamJson.slug });
      if (!team) {
        console.log(`⚠️  Team '${teamJson.slug}' not found in DB, skipping...`);
        continue;
      }

      // Check if team already has Hello Tickets ID
      const existingHtInfo = team.suppliersInfo?.find(
        (s) => s.supplierRef.toString() === supplier._id.toString()
      );

      let htId = existingHtInfo?.supplierExternalId || null;
      let htName = existingHtInfo?.supplierTeamName || null;
      let foundMethod = "existing";

      // If not found, try to find it
      if (!htId) {
        // Try known mappings first
        const mappedName = KNOWN_MAPPINGS[teamJson.name_en];
        if (mappedName && performersMap[mappedName]) {
          htId = performersMap[mappedName];
          htName = mappedName;
          foundMethod = "known-mapping";
        } else {
          // Try to find by team name
          const foundId = findHelloTicketsId(teamJson.name_en, performersMap);
          if (foundId) {
            htId = foundId;
            // Find the actual name
            for (const [name, id] of Object.entries(performersMap)) {
              if (id === foundId) {
                htName = name;
                break;
              }
            }
            foundMethod = "auto-search";
          }
        }
      }

      results.push({
        name_he: team.name,
        name_en: teamJson.name_en,
        slug: teamJson.slug,
        htId: htId || "❌ לא נמצא",
        htName: htName || "❌ לא נמצא",
        foundMethod,
        hasInDB: !!existingHtInfo,
      });
    }

    // 5. Display results table
    console.log("\n📊 Champions League Teams - Hello Tickets IDs:\n");
    console.table(
      results.map((r) => ({
        "שם בעברית": r.name_he,
        "שם באנגלית": r.name_en,
        "HT ID": r.htId,
        "HT Name": r.htName,
        מצב: r.hasInDB ? "✅ יש במסד" : "❌ חסר",
        "איך נמצא": r.foundMethod,
      }))
    );

    // 6. Summary
    const withId = results.filter((r) => r.htId !== "❌ לא נמצא");
    const withoutId = results.filter((r) => r.htId === "❌ לא נמצא");
    const inDB = results.filter((r) => r.hasInDB);
    const notInDB = results.filter((r) => !r.hasInDB);

    console.log("\n📈 Summary:");
    console.log(
      `   ✅ Teams with Hello Tickets ID: ${withId.length}/${results.length}`
    );
    console.log(
      `   ❌ Teams without Hello Tickets ID: ${withoutId.length}/${results.length}`
    );
    console.log(`   💾 Already in database: ${inDB.length}/${results.length}`);
    console.log(
      `   📝 Need to add to database: ${notInDB.length}/${results.length}`
    );

    if (withoutId.length > 0) {
      console.log("\n⚠️  Teams without Hello Tickets ID:");
      withoutId.forEach((team) => {
        console.log(`   - ${team.name_en} (${team.name})`);
      });
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

run();
