import "dotenv/config";
import mongoose from "mongoose";
import Team from "../src/models/Team.js";
import Supplier from "../src/models/Supplier.js";

// Champions League teams that need P1 mapping
const CHAMPIONS_LEAGUE_MAPPINGS = [
  { db_name: "Monaco", p1_name: "AS Monaco" },
  { db_name: "Atalanta", p1_name: "Atalanta Bergamo" },
  { db_name: "Bayer Leverkusen", p1_name: "Bayer 04 Leverkusen" },
  { db_name: "Club Brugge KV", p1_name: "Club Brugge" },
  { db_name: "Bayern München", p1_name: "FC Bayern München" },
  { db_name: "Bodo/Glimt", p1_name: "FK Bodø/Glimt" },
  { db_name: "Inter", p1_name: "Inter Milan" },
  { db_name: "Pafos", p1_name: "Pafos FC" },
  { db_name: "Qarabag", p1_name: "Qarabağ FK" },
  { db_name: "Villarreal", p1_name: "Villarreal CF" },
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

    for (const mapping of CHAMPIONS_LEAGUE_MAPPINGS) {
      try {
        // Find team by name
        let team = await Team.findOne({
          $or: [
            { name_en: mapping.db_name },
            { name: mapping.db_name },
          ],
        });

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




