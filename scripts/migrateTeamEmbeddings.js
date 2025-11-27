import mongoose from "mongoose";
import dotenv from "dotenv";
import Team from "../src/models/Team.js";
import TeamEmbedding from "../src/models/TeamEmbedding.js";

dotenv.config();

/**
 * Migration script to move embeddings from Team collection to TeamEmbedding collection
 * This script:
 * 1. Finds all teams with embedding data
 * 2. Creates TeamEmbedding documents for each team
 * 3. Optionally removes embedding fields from Team documents
 */

async function migrateEmbeddings() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        // Get the raw Team collection to access embedding fields
        const teamCollection = mongoose.connection.collection("teams");

        // Find all teams that have embedding data
        const teamsWithEmbeddings = await teamCollection
            .find({
                $or: [
                    { embedding_he: { $exists: true } },
                    { embedding_en: { $exists: true } },
                ],
            })
            .toArray();

        console.log(
            `Found ${teamsWithEmbeddings.length} teams with embedding data`
        );

        let migratedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const team of teamsWithEmbeddings) {
            try {
                // Check if embedding already exists
                const existingEmbedding = await TeamEmbedding.findOne({
                    teamId: team._id,
                });

                if (existingEmbedding) {
                    console.log(
                        `Skipping team ${team.name} (${team._id}) - embedding already exists`
                    );
                    skippedCount++;
                    continue;
                }

                // Create new TeamEmbedding document
                const embeddingData = {
                    teamId: team._id,
                };

                if (team.embedding_he && Array.isArray(team.embedding_he)) {
                    embeddingData.embedding_he = team.embedding_he;
                    embeddingData.embedding_he_createdAt =
                        team.embedding_he_createdAt || new Date();
                }

                if (team.embedding_en && Array.isArray(team.embedding_en)) {
                    embeddingData.embedding_en = team.embedding_en;
                    embeddingData.embedding_en_createdAt =
                        team.embedding_en_createdAt || new Date();
                }

                // Only create if we have at least one embedding
                if (embeddingData.embedding_he || embeddingData.embedding_en) {
                    await TeamEmbedding.create(embeddingData);
                    console.log(`✓ Migrated embeddings for team: ${team.name}`);
                    migratedCount++;
                }
            } catch (error) {
                console.error(`✗ Error migrating team ${team.name}:`, error.message);
                errorCount++;
            }
        }

        console.log("\n=== Migration Summary ===");
        console.log(`Total teams with embeddings: ${teamsWithEmbeddings.length}`);
        console.log(`Successfully migrated: ${migratedCount}`);
        console.log(`Skipped (already exists): ${skippedCount}`);
        console.log(`Errors: ${errorCount}`);

        // Ask if user wants to remove embedding fields from Team collection
        console.log(
            "\n⚠️  To remove embedding fields from Team collection, run:"
        );
        console.log("node backend/scripts/removeTeamEmbeddingFields.js");
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log("\nDatabase connection closed");
    }
}

// Run migration
migrateEmbeddings();
