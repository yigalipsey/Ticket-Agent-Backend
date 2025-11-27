import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Team from "../src/models/Team.js";
import Supplier from "../src/models/Supplier.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Match types we consider "certain" - exact matches and manual mappings
const CERTAIN_MATCH_TYPES = ["exact", "manual"];

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
      throw new Error(
        "P1 Travel supplier not found. Please run: npm run create-p1-supplier"
      );
    }
    console.log(
      `✅ Found P1 supplier: ${p1Supplier.name} (${p1Supplier._id})\n`
    );

    // Load mapping file
    const mappingPath = path.join(
      __dirname,
      "../data/p1/team_name_mapping.json"
    );
    const mapping = JSON.parse(fs.readFileSync(mappingPath, "utf-8"));

    let stats = {
      total: 0,
      updated: 0,
      alreadyExists: 0,
      notFound: 0,
      errors: 0,
    };

    // Process each league
    for (const [leagueSlug, teams] of Object.entries(mapping.mappings)) {
      console.log(`\n📊 Processing ${leagueSlug}...`);
      console.log("=".repeat(60));

      // Filter only certain matches
      const certainMatches = teams.filter((t) =>
        CERTAIN_MATCH_TYPES.includes(t.match_type)
      );

      console.log(
        `Found ${certainMatches.length} certain matches out of ${teams.length} total\n`
      );

      for (const match of certainMatches) {
        stats.total++;
        try {
          // Find team by name first (more reliable than code which can have duplicates)
          let team = await Team.findOne({
            $or: [{ name_en: match.db_name }, { name: match.db_name }],
          });

          // If not found by name, try by code
          if (!team) {
            team = await Team.findOne({ code: match.db_code });
          }

          if (!team) {
            console.log(
              `⚠️  Team not found: ${match.db_name} (${match.db_code})`
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
            if (existingP1Mapping.supplierTeamName !== match.p1_name) {
              existingP1Mapping.supplierTeamName = match.p1_name;
              await team.save();
              console.log(
                `✅ Updated: ${team.name_en || team.name} -> "${
                  match.p1_name
                }" (was: "${existingP1Mapping.supplierTeamName}")`
              );
              stats.updated++;
            } else {
              console.log(
                `⏭️  Already exists: ${team.name_en || team.name} -> "${
                  match.p1_name
                }"`
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
              supplierTeamName: match.p1_name,
            });

            await team.save();
            console.log(
              `✅ Added: ${team.name_en || team.name} -> "${match.p1_name}"`
            );
            stats.updated++;
          }
        } catch (error) {
          console.error(`❌ Error processing ${match.db_name}:`, error.message);
          stats.errors++;
        }
      }
    }

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total certain matches: ${stats.total}`);
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
