import "dotenv/config";
import mongoose from "mongoose";
import Team from "../src/models/Team.js";
import Supplier from "../src/models/Supplier.js";

// Premier League teams that need P1 mapping
const PREMIER_LEAGUE_MAPPINGS = [
  { db_name: "Wolves", p1_name: "Wolverhampton Wanderers FC", teamId: "68da7a5d8c51bd5b579b2112" },
  { db_name: "Brentford", p1_name: "Brentford" },
  { db_name: "Brighton", p1_name: "Brighton & Hove Albion" },
  { db_name: "Chelsea", p1_name: "Chelsea FC" },
  { db_name: "Leeds", p1_name: "Leeds United" },
  { db_name: "Newcastle", p1_name: "Newcastle United" },
  { db_name: "Nottingham Forest", p1_name: "Nottingham Forest" },
  { db_name: "Sunderland", p1_name: "Sunderland" },
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
    console.log(`✅ Found P1 supplier: ${p1Supplier.name} (${p1Supplier._id})\n`);

    let stats = {
      updated: 0,
      alreadyExists: 0,
      notFound: 0,
      errors: 0,
    };

    for (const mapping of PREMIER_LEAGUE_MAPPINGS) {
      try {
        let team;

        // If teamId is provided, use it
        if (mapping.teamId) {
          team = await Team.findById(mapping.teamId);
        }

        // If not found by ID, try by name
        if (!team) {
          team = await Team.findOne({
            $or: [
              { name_en: mapping.db_name },
              { name: mapping.db_name },
            ],
          });
        }

        if (!team) {
          console.log(`⚠️  Team not found: ${mapping.db_name}`);
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
              `✅ Updated: ${team.name_en || team.name} (${team.code}) -> "${mapping.p1_name}" (was: "${existingP1Mapping.supplierTeamName}")`
            );
            stats.updated++;
          } else {
            console.log(
              `⏭️  Already exists: ${team.name_en || team.name} (${team.code}) -> "${mapping.p1_name}"`
            );
            stats.alreadyExists++;
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
          stats.updated++;
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
    console.log(`✅ Updated/Added: ${stats.updated}`);
    console.log(`⏭️  Already exists: ${stats.alreadyExists}`);
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



