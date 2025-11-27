import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

/**
 * Script to remove embedding fields from Team collection
 * Run this AFTER successfully migrating embeddings to TeamEmbedding collection
 * This will clean up the Team documents by removing:
 * - embedding_he
 * - embedding_en
 * - embedding_he_createdAt
 * - embedding_en_createdAt
 */

async function removeEmbeddingFields() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        const teamCollection = mongoose.connection.collection("teams");

        // Count documents with embedding fields
        const countWithEmbeddings = await teamCollection.countDocuments({
            $or: [
                { embedding_he: { $exists: true } },
                { embedding_en: { $exists: true } },
                { embedding_he_createdAt: { $exists: true } },
                { embedding_en_createdAt: { $exists: true } },
            ],
        });

        console.log(
            `Found ${countWithEmbeddings} teams with embedding fields to remove`
        );

        if (countWithEmbeddings === 0) {
            console.log("No embedding fields found. Nothing to remove.");
            return;
        }

        // Confirm before proceeding
        console.log("\n⚠️  WARNING: This will permanently remove embedding fields from Team documents");
        console.log("Make sure you have:");
        console.log("1. Successfully run the migration script");
        console.log("2. Verified the data in TeamEmbedding collection");
        console.log("3. Created a backup of your database");
        console.log("\nProceeding with removal in 5 seconds...");

        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Remove embedding fields
        const result = await teamCollection.updateMany(
            {},
            {
                $unset: {
                    embedding_he: "",
                    embedding_en: "",
                    embedding_he_createdAt: "",
                    embedding_en_createdAt: "",
                },
            }
        );

        console.log("\n=== Removal Summary ===");
        console.log(`Documents matched: ${result.matchedCount}`);
        console.log(`Documents modified: ${result.modifiedCount}`);
        console.log("✓ Embedding fields removed successfully");
    } catch (error) {
        console.error("Removal failed:", error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log("\nDatabase connection closed");
    }
}

// Run removal
removeEmbeddingFields();
