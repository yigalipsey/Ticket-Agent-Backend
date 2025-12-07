import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Agent from "../src/models/Agent.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

// Load environment variables
dotenv.config();

/**
 * Script to update fix-tickets agent email and password
 */

const oldEmail = "fix-tickets@ticketagent.com";
const newEmail = "Lior.fixtickets@gmail.com";
// Strong password: 16 characters, mixed case, numbers, special chars
const newPassword = "FixTickets2024!@#Secure";

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

async function updateFixTicketsAgent() {
  try {
    logWithCheckpoint(
      "info",
      `Updating agent with email: ${oldEmail}`,
      "SCRIPT_003"
    );

    // Find agent by old email
    const agent = await Agent.findOne({ email: oldEmail });

    if (!agent) {
      logWithCheckpoint(
        "error",
        `Agent not found with email: ${oldEmail}`,
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
        currentEmail: agent.email,
      }
    );

    // Check if new email already exists (different agent)
    const emailExists = await Agent.findOne({
      email: newEmail,
      _id: { $ne: agent._id },
    });

    if (emailExists) {
      logWithCheckpoint(
        "error",
        `Email ${newEmail} already exists for another agent`,
        "SCRIPT_005",
        {
          existingAgentId: emailExists._id,
        }
      );
      return {
        success: false,
        error: "Email already exists for another agent",
      };
    }

    // Hash new password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update agent
    agent.email = newEmail;
    agent.passwordHash = passwordHash;
    await agent.save({ runValidators: true });

    logWithCheckpoint(
      "info",
      `Successfully updated agent: ${agent.name}`,
      "SCRIPT_006",
      {
        agentId: agent._id,
        oldEmail: oldEmail,
        newEmail: agent.email,
      }
    );

    return {
      success: true,
      agent: {
        _id: agent._id,
        email: agent.email,
        name: agent.name,
        whatsapp: agent.whatsapp,
      },
    };
  } catch (error) {
    logError(error, { operation: "updateFixTicketsAgent", oldEmail, newEmail });
    throw error;
  }
}

async function main() {
  try {
    // Connect to database
    await connectToDatabase();

    // Update agent
    const result = await updateFixTicketsAgent();

    if (result.success) {
      console.log("\n✅ Successfully updated agent:");
      console.log(`   Name: ${result.agent.name}`);
      console.log(`   Old Email: ${oldEmail}`);
      console.log(`   New Email: ${result.agent.email}`);
      console.log(`   WhatsApp: ${result.agent.whatsapp}`);
      console.log(`   ID: ${result.agent._id}`);
      console.log(`\n📧 New Email: ${newEmail}`);
      console.log(`🔐 New Password: ${newPassword}`);
      console.log("\n⚠️  Please save these credentials securely!");
    } else {
      console.log("\n❌ Failed to update agent:");
      console.log(`   Error: ${result.error}`);
    }
  } catch (error) {
    logError(error, { operation: "main" });
    console.error("❌ Error updating agent:", error.message);
    if (error.code === 11000) {
      console.error(
        "   Duplicate key error - email already exists for another agent"
      );
    }
    process.exit(1);
  } finally {
    // Disconnect from database
    await mongoose.disconnect();
    logWithCheckpoint("info", "Disconnected from MongoDB", "SCRIPT_007");
  }
}

// Run the script
main();
