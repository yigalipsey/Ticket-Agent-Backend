import dotenv from "dotenv";
import mongoose from "mongoose";
import Agent from "../src/models/Agent.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

// Load environment variables
dotenv.config();

/**
 * Script to update Arena Tickets logo
 */

const agentId = "6935a01df16ba73c65922746";
const imageUrl =
  "https://res.cloudinary.com/djgwgeeqr/image/upload/v1765123011/%D7%9C%D7%9C%D7%90_%D7%A9%D7%9D_270_x_48_%D7%A4%D7%99%D7%A7%D7%A1%D7%9C_2_rswq6m.png";

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

async function updateArenaTicketsLogo() {
  try {
    logWithCheckpoint(
      "info",
      `Updating agent ${agentId} with new imageUrl`,
      "SCRIPT_003"
    );

    const agent = await Agent.findById(agentId);

    if (!agent) {
      logWithCheckpoint(
        "error",
        `Agent not found with ID: ${agentId}`,
        "SCRIPT_004"
      );
      return { success: false, error: "Agent not found" };
    }

    logWithCheckpoint(
      "info",
      `Found agent: ${agent.name || agent.companyName || agent.email}`,
      "SCRIPT_004",
      {
        agentId: agent._id,
        currentImageUrl: agent.imageUrl,
        currentLogoUrl: agent.logoUrl,
      }
    );

    // Update imageUrl
    agent.imageUrl = imageUrl;
    await agent.save({ runValidators: true });

    logWithCheckpoint(
      "info",
      `Successfully updated agent: ${agent.name || agent.companyName}`,
      "SCRIPT_005",
      {
        agentId: agent._id,
        newImageUrl: agent.imageUrl,
      }
    );

    return {
      success: true,
      agent: {
        _id: agent._id,
        name: agent.name,
        companyName: agent.companyName,
        email: agent.email,
        imageUrl: agent.imageUrl,
        logoUrl: agent.logoUrl,
      },
    };
  } catch (error) {
    logError(error, { operation: "updateArenaTicketsLogo", agentId });
    throw error;
  }
}

async function main() {
  try {
    // Connect to database
    await connectToDatabase();

    // Update agent
    const result = await updateArenaTicketsLogo();

    if (result.success) {
      console.log("\n✅ Successfully updated agent:");
      console.log(`   Name: ${result.agent.name || result.agent.companyName}`);
      console.log(`   Email: ${result.agent.email}`);
      console.log(`   Image URL: ${result.agent.imageUrl}`);
      console.log(`   Logo URL: ${result.agent.logoUrl || "Not set"}`);
      console.log(`   ID: ${result.agent._id}`);
    } else {
      console.log("\n❌ Failed to update agent:");
      console.log(`   Error: ${result.error}`);
    }
  } catch (error) {
    logError(error, { operation: "main" });
    console.error("❌ Error updating agent:", error.message);
    process.exit(1);
  } finally {
    // Disconnect from database
    await mongoose.disconnect();
    logWithCheckpoint("info", "Disconnected from MongoDB", "SCRIPT_006");
  }
}

// Run the script
main();
