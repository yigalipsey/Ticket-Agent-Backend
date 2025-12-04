import dotenv from "dotenv";
import mongoose from "mongoose";
import Agent from "../src/models/Agent.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

// Load environment variables
dotenv.config();

/**
 * Script to update external rating for a specific agent
 */

const agentId = "68ee4f9ef233c26ce400cb9f";
const externalRating = {
  rating: 4.8,
  url: "https://www.google.com/search?q=%D7%9B%D7%9C+%D7%AA%D7%95%D7%A8&oq=%D7%9B%D7%9C+%D7%AA%D7%95%D7%A8&gs_lcrp=EgZjaHJvbWUqCQgAECMYJxjjAjIJCAAQIxgnGOMCMgwIARAuGCcYrwEYxwEyBwgCEAAYgAQyBwgDEAAYgAQyBwgEEAAYgAQyBggFEEUYPTIGCAYQRRg9MgYIBxBFGDzSAQc4NDNqMGo3qAIAsAIA&sourceid=chrome&ie=UTF-8#lrd=0x151d360d76ea1beebfba0929,1,,,,",
  provider: "google",
};

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

async function updateAgentExternalRating() {
  try {
    logWithCheckpoint(
      "info",
      `Updating agent ${agentId} with external rating`,
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
        currentRating: agent.externalRating?.rating || null,
        currentUrl: agent.externalRating?.url || null,
      }
    );

    agent.externalRating = externalRating;
    await agent.save({ runValidators: true });

    logWithCheckpoint(
      "info",
      `Updated agent: ${agent.name || agent.companyName || agent.email}`,
      "SCRIPT_005",
      {
        agentId: agent._id,
        rating: agent.externalRating.rating,
        url: agent.externalRating.url,
        provider: agent.externalRating.provider,
      }
    );

    return {
      success: true,
      agent: {
        _id: agent._id,
        name: agent.name || agent.companyName,
        email: agent.email,
        externalRating: agent.externalRating,
      },
    };
  } catch (error) {
    logError(error, { operation: "updateAgentExternalRating", agentId });
    throw error;
  }
}

async function main() {
  try {
    // Connect to database
    await connectToDatabase();

    // Update agent
    const result = await updateAgentExternalRating();

    if (result.success) {
      console.log("\n✅ Successfully updated agent with external rating:");
      console.log(`   Name: ${result.agent.name || result.agent.email}`);
      console.log(`   ID: ${result.agent._id}`);
      console.log(`   Provider: ${result.agent.externalRating.provider}`);
      console.log(`   Rating: ${result.agent.externalRating.rating}`);
      console.log(`   URL: ${result.agent.externalRating.url}`);
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

