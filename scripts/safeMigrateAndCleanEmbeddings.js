import mongoose from "mongoose";
import dotenv from "dotenv";
import Team from "../src/models/Team.js";
import TeamEmbedding from "../src/models/TeamEmbedding.js";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

/**
 * Safe Migration Script: Team -> TeamEmbedding
 *
 * Process:
 * 1. Find all teams with embedding data.
 * 2. For each team:
 *    a. Create/Update TeamEmbedding document.
 *    b. VERIFY that the data was saved correctly.
 *    c. If verification passes, remove embedding fields from the original Team document.
 *    d. If verification fails, skip removal and log error.
 */

async function safeMigrateAndClean() {
    try {
        console.log("🔌 Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ Connected to MongoDB");

        // Get raw collection for direct access if needed, but Mongoose models are fine here
        const teamCollection = mongoose.connection.collection("teams");

        // 1. Find teams with embeddings
        console.log("🔍 Scanning for teams with embedding data...");
        const teamsWithEmbeddings = await Team.find({
            $or: [
                { embedding_he: { $exists: true, $ne: [] } },
                { embedding_en: { $exists: true, $ne: [] } },
            ],
        }).lean();

        const totalTeams = teamsWithEmbeddings.length;
        console.log(`📊 Found ${totalTeams} teams to migrate.`);

        if (totalTeams === 0) {
            console.log("✨ No teams with embeddings found. Nothing to do.");
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        console.log("\n🚀 Starting migration and verification process...\n");

        for (const team of teamsWithEmbeddings) {
            try {
                process.stdout.write(`Processing ${team.name} (${team._id})... `);

                // --- Step A: Prepare Data ---
                const embeddingData = {
                    teamId: team._id,
                };

                let hasDataToMigrate = false;

                if (team.embedding_he && team.embedding_he.length > 0) {
                    embeddingData.embedding_he = team.embedding_he;
                    embeddingData.embedding_he_createdAt =
                        team.embedding_he_createdAt || team.createdAt || new Date();
                    hasDataToMigrate = true;
                }

                if (team.embedding_en && team.embedding_en.length > 0) {
                    embeddingData.embedding_en = team.embedding_en;
                    embeddingData.embedding_en_createdAt =
                        team.embedding_en_createdAt || team.createdAt || new Date();
                    hasDataToMigrate = true;
                }

                if (!hasDataToMigrate) {
                    console.log("⚠️  Skipped (Empty arrays)");
                    continue;
                }

                // --- Step B: Write to New Model ---
                // upsert: true ensures we create if not exists, update if exists
                const savedEmbedding = await TeamEmbedding.findOneAndUpdate(
                    { teamId: team._id },
                    embeddingData,
                    { upsert: true, new: true }
                );

                // --- Step C: VERIFICATION ---
                let verificationPassed = true;

                if (
                    team.embedding_he &&
                    team.embedding_he.length > 0 &&
                    (!savedEmbedding.embedding_he ||
                        savedEmbedding.embedding_he.length !== team.embedding_he.length)
                ) {
                    verificationPassed = false;
                    console.error("❌ Verification Failed: Hebrew embedding mismatch");
                }

                if (
                    team.embedding_en &&
                    team.embedding_en.length > 0 &&
                    (!savedEmbedding.embedding_en ||
                        savedEmbedding.embedding_en.length !== team.embedding_en.length)
                ) {
                    verificationPassed = false;
                    console.error("❌ Verification Failed: English embedding mismatch");
                }

                // --- Step D: Clean Old Data (Only if Verified) ---
                if (verificationPassed) {
                    await Team.updateOne(
                        { _id: team._id },
                        {
                            $unset: {
                                embedding_he: 1,
                                embedding_en: 1,
                                embedding_he_createdAt: 1,
                                embedding_en_createdAt: 1,
                            },
                        }
                    );
                    console.log("✅ Migrated & Cleaned");
                    successCount++;
                } else {
                    console.log("❌ Skipped cleaning due to verification failure");
                    errorCount++;
                }
            } catch (err) {
                console.log(`❌ Error: ${err.message}`);
                errorCount++;
            }
        }

        console.log("\n============================================");
        console.log("🏁 Migration Summary");
        console.log("============================================");
        console.log(`Total Teams Processed: ${totalTeams}`);
        console.log(`✅ Successfully Migrated & Cleaned: ${successCount}`);
        console.log(`❌ Errors / Verification Failures: ${errorCount}`);
        console.log("============================================");
    } catch (error) {
        console.error("🔥 Critical Script Error:", error);
    } finally {
        await mongoose.connection.close();
        console.log("🔌 Database connection closed");
    }
}

safeMigrateAndClean();
