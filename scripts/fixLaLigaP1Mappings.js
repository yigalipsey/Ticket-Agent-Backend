import "dotenv/config";
import mongoose from "mongoose";
import Team from "../src/models/Team.js";
import Supplier from "../src/models/Supplier.js";
import League from "../src/models/League.js";

// Mapping of DB team names to P1 CSV names
const LA_LIGA_MAPPINGS = [
  { db_name: "Alaves", db_code: "ALA", p1_name: "Alavés" },
  { db_name: "Athletic Bilbao", db_code: "BIL", p1_name: "Athletic Bilbao" },
  { db_name: "Atletico Madrid", db_code: "MAD", p1_name: "Atlético Madrid" },
  { db_name: "Barcelona", db_code: "BAR", p1_name: "FC Barcelona" },
  { db_name: "Celta Vigo", db_code: "CEL", p1_name: "Celta de Vigo" },
  { db_name: "Elche", db_code: "ELC", p1_name: "Elche" },
  { db_name: "Espanyol", db_code: "ESP", p1_name: "RCD Espanyol" },
  { db_name: "Getafe", db_code: "GET", p1_name: "Getafe" },
  { db_name: "Girona", db_code: "GIR", p1_name: "Girona FC" },
  { db_name: "Levante", db_code: "LEV", p1_name: "Levante" },
  { db_name: "Mallorca", db_code: "MAL", p1_name: "RCD Mallorca" },
  { db_name: "Osasuna", db_code: "OSA", p1_name: "Osasuna" },
  { db_name: "Oviedo", db_code: "OVI", p1_name: "Real Oviedo" },
  { db_name: "Rayo Vallecano", db_code: "RAY", p1_name: "Rayo Vallecano" },
  { db_name: "Real Betis", db_code: "BET", p1_name: "Real Betis" },
  { db_name: "Real Madrid", db_code: "REA", p1_name: "Real Madrid" },
  { db_name: "Real Sociedad", db_code: "RSO", p1_name: "Real Sociedad" },
  { db_name: "Sevilla", db_code: "SEV", p1_name: "Sevilla FC" },
  { db_name: "Valencia", db_code: "VAL", p1_name: "Valencia CF" },
  { db_name: "Villarreal", db_code: "VIL", p1_name: "Villarreal CF" },
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
    console.log(`✅ Found P1 supplier: ${p1Supplier.name}\n`);

    // Find La Liga
    const laLiga = await League.findOne({
      $or: [
        { slug: /la.?liga/i },
        { name: /la.?liga/i },
        { slug: "la-liga" },
        { name: "La Liga" },
      ],
    });

    if (!laLiga) {
      throw new Error("La Liga not found in database");
    }
    console.log(`✅ Found La Liga: ${laLiga.name}\n`);

    let stats = {
      total: 0,
      updated: 0,
      added: 0,
      alreadyCorrect: 0,
      notFound: 0,
      errors: 0,
    };

    console.log("Processing La Liga team mappings...\n");
    console.log("=".repeat(60));

    for (const mapping of LA_LIGA_MAPPINGS) {
      stats.total++;
      try {
        // Find team by code first (more reliable)
        let team = await Team.findOne({ code: mapping.db_code });

        // If not found by code, try by name
        if (!team) {
          team = await Team.findOne({
            $or: [
              { name_en: mapping.db_name },
              { name: mapping.db_name },
            ],
          });
        }

        if (!team) {
          console.log(
            `⚠️  Team not found: ${mapping.db_name} (${mapping.db_code})`
          );
          stats.notFound++;
          continue;
        }

        // Check if P1 mapping already exists
        const existingP1Mapping = team.suppliersInfo?.find(
          (si) => si.supplierRef?.toString() === p1Supplier._id.toString()
        );

        if (existingP1Mapping) {
          // Update if different
          if (existingP1Mapping.supplierTeamName !== mapping.p1_name) {
            existingP1Mapping.supplierTeamName = mapping.p1_name;
            await team.save();
            console.log(
              `✅ Updated: ${team.name_en || team.name} (${team.code}) -> "${
                mapping.p1_name
              }" (was: "${existingP1Mapping.supplierTeamName}")`
            );
            stats.updated++;
          } else {
            console.log(
              `⏭️  Already correct: ${team.name_en || team.name} (${team.code}) -> "${
                mapping.p1_name
              }"`
            );
            stats.alreadyCorrect++;
          }
        } else {
          // Add new P1 mapping
          if (!team.suppliersInfo) {
            team.suppliersInfo = [];
          }

          team.suppliersInfo.push({
            supplierRef: p1Supplier._id,
            supplierTeamName: mapping.p1_name,
          });

          await team.save();
          console.log(
            `✅ Added: ${team.name_en || team.name} (${team.code}) -> "${mapping.p1_name}"`
          );
          stats.added++;
        }
      } catch (error) {
        console.error(
          `❌ Error processing ${mapping.db_name}:`,
          error.message
        );
        stats.errors++;
      }
    }

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total teams: ${stats.total}`);
    console.log(`✅ Added: ${stats.added}`);
    console.log(`✅ Updated: ${stats.updated}`);
    console.log(`⏭️  Already correct: ${stats.alreadyCorrect}`);
    console.log(`⚠️  Not found: ${stats.notFound}`);
    console.log(`❌ Errors: ${stats.errors}`);
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



