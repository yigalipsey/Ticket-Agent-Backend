import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import Team from "../src/models/Team.js";
import Supplier from "../src/models/Supplier.js";
import League from "../src/models/League.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_FILE = path.join(__dirname, "../data/p1-offers.csv");

// Leagues to process
const LEAGUES_TO_PROCESS = [
  { slug: "champions-league", name: "Champions League" },
  { slug: "bundesliga", name: "Bundesliga" },
  { slug: "serie-a", name: "Serie A" },
  { slug: "ligue-1", name: "Ligue 1" },
];

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined");
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  // Load CSV file
  console.log("Loading CSV file...");
  const csvContent = fs.readFileSync(CSV_FILE, "utf-8");
  const csvRecords = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
  });
  console.log(`✅ Loaded ${csvRecords.length} records from CSV\n`);

  // Get all P1 team names from CSV (any league)
  const allP1TeamNames = new Set();
  csvRecords
    .filter((r) => (r.categoryPath || "").toLowerCase().includes("football"))
    .forEach((r) => {
      if (r.home_team_name) allP1TeamNames.add(r.home_team_name.trim());
      if (r.away_team_name) allP1TeamNames.add(r.away_team_name.trim());
    });

  console.log(
    `Found ${allP1TeamNames.size} unique P1 team names in CSV (all leagues)\n`
  );

  // Find P1 supplier
  const p1Supplier = await Supplier.findOne({ slug: "p1-travel" });
  if (!p1Supplier) {
    throw new Error("P1 Travel supplier not found");
  }

  let totalStats = {
    updated: 0,
    alreadyExists: 0,
    notFound: 0,
    errors: 0,
  };

  // Process each league
  for (const leagueInfo of LEAGUES_TO_PROCESS) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`📊 Processing ${leagueInfo.name}`);
    console.log("=".repeat(70));

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

    // Get all teams from this league
    const dbTeams = await Team.find({ leagueIds: league._id })
      .select("name name_en code suppliersInfo")
      .lean();

    console.log(`Found ${dbTeams.length} teams in database\n`);

    // For each team, try to find matching P1 name in CSV
    for (const team of dbTeams) {
      const teamName = team.name_en || team.name;
      const teamCode = team.code;

      // Check if team already has P1 mapping
      const existingP1Mapping = team.suppliersInfo?.find(
        (si) => si.supplierRef?.toString() === p1Supplier._id.toString()
      );

      if (existingP1Mapping) {
        // Already has mapping, skip
        continue;
      }

      // Try to find matching P1 name
      let matchedP1Name = null;

      // Try exact match
      matchedP1Name = Array.from(allP1TeamNames).find(
        (p1Name) => p1Name.toLowerCase() === teamName.toLowerCase()
      );

      // Try partial match (remove common suffixes)
      if (!matchedP1Name) {
        const cleanTeamName = teamName
          .replace(/\s*(FC|United|City|Hotspur|Wanderers|Albion|CF|AC|AS|OSC|SC)$/i, "")
          .trim()
          .toLowerCase();

        matchedP1Name = Array.from(allP1TeamNames).find((p1Name) => {
          const cleanP1Name = p1Name
            .replace(/\s*(fc|united|city|hotspur|wanderers|albion|cf|ac|as|osc|sc)$/i, "")
            .trim()
            .toLowerCase();
          return (
            cleanP1Name === cleanTeamName ||
            cleanP1Name.includes(cleanTeamName) ||
            cleanTeamName.includes(cleanP1Name)
          );
        });
      }

      // Try matching by city/location
      if (!matchedP1Name) {
        const cityMatch = teamName.match(/(\w+\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)$/);
        if (cityMatch) {
          const cityName = cityMatch[2].toLowerCase();
          matchedP1Name = Array.from(allP1TeamNames).find((p1Name) => {
            const p1NameLower = p1Name.toLowerCase();
            return (
              p1NameLower.includes(cityName) ||
              cityName.includes(p1NameLower.split(" ").pop() || "")
            );
          });
        }
      }

      if (matchedP1Name) {
        try {
          // Load team document to update
          const teamDoc = await Team.findById(team._id);
          if (!teamDoc) continue;

          if (!teamDoc.suppliersInfo) {
            teamDoc.suppliersInfo = [];
          }

          teamDoc.suppliersInfo.push({
            supplierRef: p1Supplier._id,
            supplierTeamName: matchedP1Name,
          });

          await teamDoc.save();
          console.log(
            `✅ Added: ${teamName} (${teamCode}) -> "${matchedP1Name}"`
          );
          totalStats.updated++;
        } catch (error) {
          console.error(
            `❌ Error processing ${teamName}:`,
            error.message
          );
          totalStats.errors++;
        }
      }
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 FINAL SUMMARY");
  console.log("=".repeat(70));
  console.log(`✅ Updated/Added: ${totalStats.updated}`);
  console.log(`⏭️  Already exists: ${totalStats.alreadyExists}`);
  console.log(`⚠️  Not found: ${totalStats.notFound}`);
  console.log(`❌ Errors: ${totalStats.errors}`);

  await mongoose.disconnect();
  console.log("\n✅ Done!");
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});



