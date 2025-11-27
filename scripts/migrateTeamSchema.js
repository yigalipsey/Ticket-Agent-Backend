import mongoose from "mongoose";
import dotenv from "dotenv";
import Team from "../src/models/Team.js";

dotenv.config();

/**
 * Script to migrate Team schema:
 * 1. externalIds.apiFootball -> apiFootballId
 * 2. supplierNames -> suppliersInfo
 */
async function migrateTeamSchema() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        // We use lean() to get plain objects, which helps when the schema has already changed
        // and might not fully support the old fields if we tried to load them as Documents.
        // However, since we are running this against the DB, we can just pull everything.
        // Note: If strict mode is on in schema, fetching old fields might be tricky via Mongoose model if they are not in schema.
        // But usually find() returns what's in DB. To be safe, we can use the native collection driver or just rely on Mongoose not stripping fields on find().

        // Let's use the native collection to be safe and avoid Schema validation issues during read
        const collection = mongoose.connection.collection("teams");
        const teams = await collection.find({}).toArray();

        console.log(`Found ${teams.length} teams to process`);

        let modifiedCount = 0;
        let errorCount = 0;

        for (const team of teams) {
            const updateOps = {};
            const unsetOps = {};
            let needsUpdate = false;

            // 1. Migrate externalIds -> apiFootballId
            if (team.externalIds && team.externalIds.apiFootball) {
                updateOps.apiFootballId = team.externalIds.apiFootball;
                unsetOps.externalIds = "";
                needsUpdate = true;
            }

            // 2. Migrate supplierNames -> suppliersInfo
            if (team.supplierNames && Array.isArray(team.supplierNames) && team.supplierNames.length > 0) {
                const newSuppliersInfo = team.supplierNames.map(sn => ({
                    supplierRef: sn.supplierId,
                    supplierTeamName: sn.name,
                    // supplierExternalId: undefined // Not present in old data
                }));

                updateOps.suppliersInfo = newSuppliersInfo;
                unsetOps.supplierNames = "";
                needsUpdate = true;
            }

            if (needsUpdate) {
                try {
                    const updateQuery = { $set: updateOps };
                    if (Object.keys(unsetOps).length > 0) {
                        updateQuery.$unset = unsetOps;
                    }

                    await collection.updateOne(
                        { _id: team._id },
                        updateQuery
                    );

                    process.stdout.write(".");
                    modifiedCount++;
                } catch (err) {
                    console.error(`\nError updating team ${team.name} (${team._id}):`, err.message);
                    errorCount++;
                }
            }
        }

        console.log("\n\n=== Migration Summary ===");
        console.log(`Total teams scanned: ${teams.length}`);
        console.log(`Teams modified: ${modifiedCount}`);
        console.log(`Errors: ${errorCount}`);

    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log("\nDatabase connection closed");
    }
}

// Run migration
migrateTeamSchema();
