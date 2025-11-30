import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import { parse } from "csv-parse/sync";
import Team from "../src/models/Team.js";
import Supplier from "../src/models/Supplier.js";
import League from "../src/models/League.js";

const CSV_FILE = "./data/p1-offers.csv";

// Football leagues to check
const FOOTBALL_LEAGUES = [
  "premier league 2025-2026",
  "champions league 2025-2026",
  "bundesliga 2025-2026",
  "serie a 2025-2026",
  "ligue 1 2025-2026",
  "la liga 2025-2026",
  "eredivisie 2025-2026",
  "jupiler pro league 2025-2026",
  "primeira liga 2025-2026",
  "superliga 2025-2026",
  "championship 2025-2026",
  "europa league 2025-2026",
  "carabao cup 2025-2026",
  "coppa italia 2025-2026",
  "knvb beker 2025-2026",
  "taça de portugal 2025-2026",
];

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined");
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  try {
    // Find P1 supplier
    const p1Supplier = await Supplier.findOne({ slug: "p1-travel" });
    if (!p1Supplier) {
      throw new Error("P1 Travel supplier not found");
    }

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

    // Get all teams from DB with P1 mappings
    const allDbTeams = await Team.find({})
      .select("name name_en code suppliersInfo")
      .lean();

    const p1Mappings = new Map();
    allDbTeams.forEach((team) => {
      const p1Info = team.suppliersInfo?.find(
        (si) => si.supplierRef?.toString() === p1Supplier._id.toString()
      );
      if (p1Info && p1Info.supplierTeamName) {
        p1Mappings.set(p1Info.supplierTeamName.toLowerCase(), {
          dbTeam: team,
          p1Name: p1Info.supplierTeamName,
        });
      }
    });

    console.log(`Found ${p1Mappings.size} teams with P1 mappings in DB\n`);

    // Process each league
    const results = {};

    for (const leagueName of FOOTBALL_LEAGUES) {
      const leagueRecords = csvRecords.filter((r) => {
        const categoryPath = (r.categoryPath || "").toLowerCase();
        return categoryPath.includes(leagueName.toLowerCase());
      });

      if (leagueRecords.length === 0) continue;

      const teamsInCSV = new Set();
      leagueRecords.forEach((r) => {
        if (r.home_team_name) teamsInCSV.add(r.home_team_name.trim());
        if (r.away_team_name) teamsInCSV.add(r.away_team_name.trim());
      });

      const unmapped = [];
      const mapped = [];

      Array.from(teamsInCSV).forEach((csvTeam) => {
        const normalized = csvTeam.toLowerCase();
        if (p1Mappings.has(normalized)) {
          mapped.push(csvTeam);
        } else {
          unmapped.push(csvTeam);
        }
      });

      results[leagueName] = {
        total: teamsInCSV.size,
        mapped: mapped.length,
        unmapped: unmapped.length,
        unmappedTeams: unmapped.sort(),
        mappedTeams: mapped.sort(),
      };
    }

    // Print results
    console.log("=".repeat(70));
    console.log("📊 UNMAPPED TEAMS BY LEAGUE");
    console.log("=".repeat(70));

    let totalUnmapped = 0;
    let totalMapped = 0;

    for (const [leagueName, data] of Object.entries(results)) {
      console.log(`\n📋 ${leagueName.toUpperCase()}`);
      console.log(`   Total teams in CSV: ${data.total}`);
      console.log(`   ✅ Mapped: ${data.mapped}`);
      console.log(`   ❌ Unmapped: ${data.unmapped}`);

      if (data.unmapped > 0) {
        console.log(`\n   Unmapped teams:`);
        data.unmappedTeams.forEach((team) => {
          console.log(`     - ${team}`);
        });
      }

      totalMapped += data.mapped;
      totalUnmapped += data.unmapped;
    }

    console.log("\n" + "=".repeat(70));
    console.log("📊 SUMMARY");
    console.log("=".repeat(70));
    console.log(`Total mapped teams: ${totalMapped}`);
    console.log(`Total unmapped teams: ${totalUnmapped}`);
    console.log(`Total teams in CSV: ${totalMapped + totalUnmapped}`);

    // Also check if any unmapped teams exist in DB but without P1 mapping
    console.log("\n" + "=".repeat(70));
    console.log("🔍 CHECKING IF UNMAPPED TEAMS EXIST IN DB (without P1 mapping)");
    console.log("=".repeat(70));

    const allUnmappedTeams = new Set();
    Object.values(results).forEach((data) => {
      data.unmappedTeams.forEach((team) => allUnmappedTeams.add(team));
    });

    const existingInDb = [];
    const notInDb = [];

    for (const csvTeam of allUnmappedTeams) {
      // Try to find by name (case insensitive)
      const found = allDbTeams.find((dbTeam) => {
        const dbName = (dbTeam.name_en || dbTeam.name || "").toLowerCase();
        const csvName = csvTeam.toLowerCase();
        return (
          dbName === csvName ||
          dbName.includes(csvName) ||
          csvName.includes(dbName)
        );
      });

      if (found) {
        existingInDb.push({
          csvName: csvTeam,
          dbName: found.name_en || found.name,
          code: found.code,
        });
      } else {
        notInDb.push(csvTeam);
      }
    }

    if (existingInDb.length > 0) {
      console.log(
        `\n✅ Found ${existingInDb.length} unmapped teams that EXIST in DB (need P1 mapping):`
      );
      existingInDb.forEach((item) => {
        console.log(
          `   - CSV: "${item.csvName}" -> DB: ${item.dbName} (${item.code})`
        );
      });
    }

    if (notInDb.length > 0) {
      console.log(
        `\n❌ Found ${notInDb.length} unmapped teams that DON'T EXIST in DB:`
      );
      notInDb.sort().forEach((team) => {
        console.log(`   - ${team}`);
      });
    }
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




