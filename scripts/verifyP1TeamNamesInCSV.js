import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import Team from "../src/models/Team.js";
import League from "../src/models/League.js";
import Supplier from "../src/models/Supplier.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_FILE = path.join(__dirname, "../data/p1-offers.csv");

// League slugs to check
const LEAGUES_TO_CHECK = [
  {
    slug: "premier-league",
    name: "Premier League",
    csvLeague: "premier league 2025-2026",
  },
  { slug: "bundesliga", name: "Bundesliga", csvLeague: "bundesliga 2025-2026" },
  { slug: "serie-a", name: "Serie A", csvLeague: "serie a 2025-2026" },
  { slug: "ligue-1", name: "Ligue 1", csvLeague: "ligue 1 2025-2026" },
  {
    slug: "champions-league",
    name: "Champions League",
    csvLeague: "champions league 2025-2026",
  },
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

  // Find P1 supplier
  const p1Supplier = await Supplier.findOne({ slug: "p1-travel" });
  if (!p1Supplier) {
    throw new Error("P1 Travel supplier not found");
  }

  // Process each league
  for (const leagueInfo of LEAGUES_TO_CHECK) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`📊 Checking ${leagueInfo.name}`);
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

    // Get teams from database with P1 mappings
    const dbTeams = await Team.find({ leagueIds: league._id })
      .select("name name_en code suppliersInfo")
      .lean();

    console.log(`\nFound ${dbTeams.length} teams in database`);

    // Filter teams with P1 mappings
    const teamsWithP1 = dbTeams
      .map((team) => {
        const p1Info = team.suppliersInfo?.find(
          (si) => si.supplierRef?.toString() === p1Supplier._id.toString()
        );
        return p1Info
          ? {
              db_name: team.name_en || team.name,
              p1_name: p1Info.supplierTeamName,
              code: team.code,
            }
          : null;
      })
      .filter((t) => t !== null);

    console.log(`Found ${teamsWithP1.length} teams with P1 mappings\n`);

    // Get all team names from CSV for this league
    const csvTeamNames = new Set();
    csvRecords
      .filter((r) => {
        const categoryPath = (r.categoryPath || "").toLowerCase();
        return categoryPath.includes(leagueInfo.csvLeague.toLowerCase());
      })
      .forEach((r) => {
        if (r.home_team_name) csvTeamNames.add(r.home_team_name.trim());
        if (r.away_team_name) csvTeamNames.add(r.away_team_name.trim());
      });

    console.log(
      `Found ${csvTeamNames.size} unique team names in CSV for ${leagueInfo.name}\n`
    );

    // Get all teams from DB (with and without P1 mappings)
    const allDbTeams = dbTeams.map((team) => ({
      db_name: team.name_en || team.name,
      code: team.code,
      hasP1Mapping: team.suppliersInfo?.some(
        (si) => si.supplierRef?.toString() === p1Supplier._id.toString()
      ),
      p1_name:
        team.suppliersInfo?.find(
          (si) => si.supplierRef?.toString() === p1Supplier._id.toString()
        )?.supplierTeamName || null,
    }));

    // Check each team with P1 mapping
    let found = 0;
    let notFound = 0;
    const notFoundTeams = [];
    const foundTeams = [];

    for (const team of teamsWithP1) {
      const existsInCSV = csvTeamNames.has(team.p1_name);
      if (existsInCSV) {
        found++;
        foundTeams.push(team);
      } else {
        notFound++;
        notFoundTeams.push(team);
      }
    }

    // Teams in DB without P1 mappings
    const teamsWithoutP1Mapping = allDbTeams.filter((t) => !t.hasP1Mapping);

    // Teams in CSV that we don't have mappings for
    const mappedP1Names = new Set(teamsWithP1.map((t) => t.p1_name));
    const unmappedInCSV = Array.from(csvTeamNames)
      .filter((name) => !mappedP1Names.has(name))
      .sort();

    // Check if unmapped CSV teams exist in DB with different names
    const csvTeamsNotInDB = [];
    const csvTeamsInDBWithDifferentName = [];

    for (const csvTeamName of unmappedInCSV) {
      // Try to find in DB by various methods
      const cleanCsvName = csvTeamName
        .replace(
          /\s*(FC|United|City|Hotspur|Wanderers|Albion|CF|AC|AS|OSC|SC)$/i,
          ""
        )
        .trim()
        .toLowerCase();

      let foundInDB = false;
      let dbTeamName = null;

      // Try exact match
      let dbTeam = dbTeams.find(
        (t) =>
          (t.name_en || "").toLowerCase() === csvTeamName.toLowerCase() ||
          (t.name || "").toLowerCase() === csvTeamName.toLowerCase()
      );

      if (dbTeam) {
        foundInDB = true;
        dbTeamName = dbTeam.name_en || dbTeam.name;
      } else {
        // Try partial match
        dbTeam = dbTeams.find((t) => {
          const dbName = (t.name_en || t.name || "").toLowerCase();
          const cleanDbName = dbName
            .replace(
              /\s*(fc|united|city|hotspur|wanderers|albion|cf|ac|as|osc|sc)$/i,
              ""
            )
            .trim();
          return (
            dbName.includes(cleanCsvName) ||
            cleanCsvName.includes(cleanDbName) ||
            cleanDbName === cleanCsvName
          );
        });

        if (dbTeam) {
          foundInDB = true;
          dbTeamName = dbTeam.name_en || dbTeam.name;
        } else {
          // Try matching by removing numbers and special chars
          const normalizedCsv = csvTeamName
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
              dbName === normalizedCsv ||
              dbName.includes(normalizedCsv) ||
              normalizedCsv.includes(dbName)
            );
          });

          if (dbTeam) {
            foundInDB = true;
            dbTeamName = dbTeam.name_en || dbTeam.name;
          }
        }
      }

      if (foundInDB) {
        csvTeamsInDBWithDifferentName.push({
          csv_name: csvTeamName,
          db_name: dbTeamName,
        });
      } else {
        csvTeamsNotInDB.push(csvTeamName);
      }
    }

    // Teams in DB that don't appear in CSV at all (even without P1 mapping)
    const allDbTeamNames = new Set(
      allDbTeams.map((t) => t.db_name.toLowerCase())
    );
    const teamsInDBButNotInCSV = allDbTeams.filter((team) => {
      // Check if any CSV team name might match this DB team
      const dbNameLower = team.db_name.toLowerCase();
      return !Array.from(csvTeamNames).some((csvName) => {
        const csvNameLower = csvName.toLowerCase();
        return (
          csvNameLower.includes(dbNameLower) ||
          dbNameLower.includes(csvNameLower) ||
          csvNameLower.replace(/\s*(fc|united|city)$/i, "") ===
            dbNameLower.replace(/\s*(fc|united|city)$/i, "")
        );
      });
    });

    console.log(`\n📊 Summary for ${leagueInfo.name}:`);
    console.log("=".repeat(70));
    console.log(`\n✅ Teams WITH P1 mapping that ARE in CSV (${found}):`);
    foundTeams.forEach((t) => {
      console.log(`   - ${t.db_name} (${t.code}) -> "${t.p1_name}"`);
    });

    if (notFound > 0) {
      console.log(
        `\n❌ Teams WITH P1 mapping that are NOT in CSV (${notFound}):`
      );
      notFoundTeams.forEach((t) => {
        console.log(`   - ${t.db_name} (${t.code}) -> "${t.p1_name}"`);
      });
    }

    if (teamsWithoutP1Mapping.length > 0) {
      console.log(
        `\n⚠️  Teams WITHOUT P1 mapping in database (${teamsWithoutP1Mapping.length}):`
      );
      teamsWithoutP1Mapping.forEach((t) => {
        console.log(`   - ${t.db_name} (${t.code})`);
      });
    }

    if (csvTeamsInDBWithDifferentName.length > 0) {
      console.log(
        `\n🔍 Teams in CSV that EXIST in DB but with different names (${csvTeamsInDBWithDifferentName.length}):`
      );
      csvTeamsInDBWithDifferentName.forEach(({ csv_name, db_name }) => {
        console.log(`   - CSV: "${csv_name}" → DB: ${db_name}`);
      });
    }

    if (csvTeamsNotInDB.length > 0) {
      console.log(
        `\n❌ Teams in CSV that DON'T EXIST in DB at all (${csvTeamsNotInDB.length}):`
      );
      csvTeamsNotInDB.forEach((name) => {
        console.log(`   - "${name}"`);
      });
    }

    if (teamsInDBButNotInCSV.length > 0) {
      console.log(
        `\n📋 Teams in DB that don't appear in CSV at all (${teamsInDBButNotInCSV.length}):`
      );
      teamsInDBButNotInCSV.forEach((t) => {
        console.log(`   - ${t.db_name} (${t.code})`);
      });
    }

    console.log(`\n📈 Totals:`);
    console.log(`   - Teams in DB: ${allDbTeams.length}`);
    console.log(`   - Teams with P1 mapping: ${teamsWithP1.length}`);
    console.log(`   - Teams with P1 mapping in CSV: ${found}`);
    console.log(`   - Teams with P1 mapping NOT in CSV: ${notFound}`);
    console.log(`   - Teams in CSV without mapping: ${unmappedInCSV.length}`);
  }

  await mongoose.disconnect();
  console.log("\n✅ Done!");
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
