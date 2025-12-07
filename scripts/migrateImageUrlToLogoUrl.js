import dotenv from "dotenv";
import mongoose from "mongoose";
import Agent from "../src/models/Agent.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

// Load environment variables
dotenv.config();

/**
 * Script to migrate imageUrl to logoUrl for all agents
 * This will copy imageUrl to logoUrl and clear imageUrl
 */

async function connectToDatabase() {
  try {
    logWithCheckpoint("info", "Connecting to MongoDB", "SCRIPT_001");

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
    });

    logWithCheckpoint(
      "info",
      "Successfully connected to MongoDB",
      "SCRIPT_002"
    );
  } catch (error) {
    logError(error, { operation: "connectToDatabase" });
    throw error;
  }
}

async function migrateImageUrlToLogoUrl() {
  try {
    logWithCheckpoint(
      "info",
      "Starting migration: imageUrl -> logoUrl",
      "SCRIPT_003"
    );

    // Find all agents that have imageUrl
    const agentsWithImageUrl = await Agent.find({
      imageUrl: { $exists: true, $ne: null, $ne: "" },
    });

    logWithCheckpoint(
      "info",
      `Found ${agentsWithImageUrl.length} agents with imageUrl`,
      "SCRIPT_004"
    );

    if (agentsWithImageUrl.length === 0) {
      return {
        success: true,
        message: "No agents with imageUrl found",
        updated: 0,
      };
    }

    let updatedCount = 0;
    let skippedCount = 0;

    // Update each agent
    for (const agent of agentsWithImageUrl) {
      try {
        // Only update if logoUrl is empty or doesn't exist
        if (!agent.logoUrl || agent.logoUrl === "") {
          agent.logoUrl = agent.imageUrl;
          agent.imageUrl = ""; // Clear imageUrl
          await agent.save({ runValidators: true });
          updatedCount++;

          logWithCheckpoint(
            "info",
            `Updated agent: ${agent.name || agent.companyName || agent.email}`,
            "SCRIPT_005",
            {
              agentId: agent._id,
              oldImageUrl: agent.imageUrl,
              newLogoUrl: agent.logoUrl,
            }
          );
        } else {
          // If logoUrl already exists, just clear imageUrl
          agent.imageUrl = "";
          await agent.save({ runValidators: true });
          skippedCount++;

          logWithCheckpoint(
            "info",
            `Skipped logoUrl update (already exists), cleared imageUrl: ${
              agent.name || agent.companyName || agent.email
            }`,
            "SCRIPT_006",
            {
              agentId: agent._id,
              existingLogoUrl: agent.logoUrl,
            }
          );
        }
      } catch (agentError) {
        logError(agentError, {
          operation: "migrateImageUrlToLogoUrl",
          agentId: agent._id,
        });
        console.error(`Error updating agent ${agent._id}:`, agentError.message);
      }
    }

    return {
      success: true,
      updated: updatedCount,
      skipped: skippedCount,
      total: agentsWithImageUrl.length,
    };
  } catch (error) {
    logError(error, { operation: "migrateImageUrlToLogoUrl" });
    throw error;
  }
}

async function main() {
  try {
    // Connect to database
    await connectToDatabase();

    // Migrate imageUrl to logoUrl
    const result = await migrateImageUrlToLogoUrl();

    if (result.success) {
      console.log("\n✅ Migration completed successfully:");
      console.log(`   Total agents with imageUrl: ${result.total || 0}`);
      console.log(`   Updated (imageUrl -> logoUrl): ${result.updated || 0}`);
      console.log(
        `   Skipped (logoUrl already exists): ${result.skipped || 0}`
      );
      console.log(
        `   Total processed: ${(result.updated || 0) + (result.skipped || 0)}`
      );
    } else {
      console.log("\n❌ Migration failed:");
      console.log(`   Error: ${result.error || "Unknown error"}`);
    }
  } catch (error) {
    logError(error, { operation: "main" });
    console.error("❌ Error during migration:", error.message);
    process.exit(1);
  } finally {
    // Disconnect from database
    await mongoose.disconnect();
    logWithCheckpoint("info", "Disconnected from MongoDB", "SCRIPT_007");
  }
}

// Run the script
main();
