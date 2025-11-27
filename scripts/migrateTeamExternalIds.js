import mongoose from "mongoose";
import dotenv from "dotenv";
import Team from "../src/models/Team.js";

dotenv.config();

/**
 * Script to migrate Team externalIds to apiFootballId
 * This will:
 * 1. Find all teams with externalIds.apiFootball
 * 2. Set apiFootballId to the value of externalIds.apiFootball
 * 3. Unset externalIds field
 */

async function migrateTeamExternalIds() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        // Find teams that need migration (have externalIds but no apiFootballId)
        // Note: We use the raw collection access or a relaxed schema check because
        // the Mongoose model might enforce the new schema which could cause issues
        // if we try to query fields that are no longer in the schema but exist in DB.
        // However, Mongoose usually allows querying existing fields even if not in schema if strict is false or using lean.
        // But to be safe and simple, we'll iterate.

        const teams = await Team.find({
            "externalIds.apiFootball": { $exists: true },
            apiFootballId: { $exists: false }
        }).lean();

        console.log(`Found ${teams.length} teams to migrate`);

        if (teams.length === 0) {
            console.log("No teams need migration.");
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const team of teams) {
            try {
                const apiFootballId = team.externalIds?.apiFootball;

                if (apiFootballId) {
                    await Team.updateOne(
                        { _id: team._id },
                        {
                            $set: { apiFootballId: apiFootballId },
                            $unset: { externalIds: "" }
                        }
                    );
                    process.stdout.write(".");
                    successCount++;
                }
            } catch (err) {
                console.error(`\nError migrating team ${team.name} (${team._id}):`, err.message);
                errorCount++;
            }
        }

        console.log("\n\n=== Migration Summary ===");
        console.log(`Total processed: ${teams.length}`);
        console.log(`Successful: ${successCount}`);
        console.log(`Failed: ${errorCount}`);

    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log("\nDatabase connection closed");
    }
}

// Run migration
migrateTeamExternalIds();
