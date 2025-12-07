import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Agent from "../src/models/Agent.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

// Load environment variables
dotenv.config();

/**
 * Script to create a new agent: fix-tickets
 */

const agentData = {
  email: "fix-tickets@ticketagent.com",
  password: "FixTickets2024!", // This will be hashed
  name: "fix-tickets",
  whatsapp: "+972526078000",
  instagramUrl: "https://www.instagram.com/fix_tickets/",
  imageUrl:
    "https://res.cloudinary.com/djgwgeeqr/image/upload/v1765118687/4_ncquzg.png",
  agentType: "individual",
  isActive: true,
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

async function createFixTicketsAgent() {
  try {
    logWithCheckpoint(
      "info",
      `Creating agent: ${agentData.name}`,
      "SCRIPT_003"
    );

    // Check if agent already exists
    const existingAgent = await Agent.findOne({
      $or: [
        { email: agentData.email },
        { whatsapp: agentData.whatsapp },
        { name: agentData.name },
      ],
    });

    if (existingAgent) {
      logWithCheckpoint(
        "warn",
        `Agent already exists with email: ${agentData.email} or whatsapp: ${agentData.whatsapp}`,
        "SCRIPT_004",
        {
          existingAgentId: existingAgent._id,
          existingEmail: existingAgent.email,
          existingWhatsapp: existingAgent.whatsapp,
        }
      );
      return {
        success: false,
        error: "Agent already exists",
        existingAgent: {
          _id: existingAgent._id,
          email: existingAgent.email,
          whatsapp: existingAgent.whatsapp,
          name: existingAgent.name,
        },
      };
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(agentData.password, saltRounds);

    // Create agent object
    const newAgentData = {
      email: agentData.email,
      passwordHash: passwordHash,
      name: agentData.name,
      whatsapp: agentData.whatsapp,
      instagramUrl: agentData.instagramUrl,
      imageUrl: agentData.imageUrl,
      agentType: agentData.agentType,
      isActive: agentData.isActive,
    };

    const agent = new Agent(newAgentData);
    await agent.save({ runValidators: true });

    logWithCheckpoint(
      "info",
      `Successfully created agent: ${agent.name}`,
      "SCRIPT_005",
      {
        agentId: agent._id,
        email: agent.email,
        whatsapp: agent.whatsapp,
        instagramUrl: agent.instagramUrl,
        imageUrl: agent.imageUrl,
      }
    );

    return {
      success: true,
      agent: {
        _id: agent._id,
        email: agent.email,
        name: agent.name,
        whatsapp: agent.whatsapp,
        instagramUrl: agent.instagramUrl,
        imageUrl: agent.imageUrl,
        agentType: agent.agentType,
        isActive: agent.isActive,
      },
    };
  } catch (error) {
    logError(error, { operation: "createFixTicketsAgent", agentData });
    throw error;
  }
}

async function main() {
  try {
    // Connect to database
    await connectToDatabase();

    // Create agent
    const result = await createFixTicketsAgent();

    if (result.success) {
      console.log("\n✅ Successfully created agent:");
      console.log(`   Name: ${result.agent.name}`);
      console.log(`   Email: ${result.agent.email}`);
      console.log(`   WhatsApp: ${result.agent.whatsapp}`);
      console.log(`   Instagram: ${result.agent.instagramUrl}`);
      console.log(`   Image URL: ${result.agent.imageUrl}`);
      console.log(`   ID: ${result.agent._id}`);
      console.log(`   Type: ${result.agent.agentType}`);
      console.log(`   Active: ${result.agent.isActive}`);
    } else {
      console.log("\n❌ Failed to create agent:");
      if (result.error === "Agent already exists") {
        console.log(`   Agent already exists:`);
        console.log(`   ID: ${result.existingAgent._id}`);
        console.log(`   Email: ${result.existingAgent.email}`);
        console.log(`   WhatsApp: ${result.existingAgent.whatsapp}`);
        console.log(`   Name: ${result.existingAgent.name}`);
      } else {
        console.log(`   Error: ${result.error}`);
      }
    }
  } catch (error) {
    logError(error, { operation: "main" });
    console.error("❌ Error creating agent:", error.message);
    if (error.code === 11000) {
      console.error(
        "   Duplicate key error - agent with this email or whatsapp already exists"
      );
    }
    process.exit(1);
  } finally {
    // Disconnect from database
    await mongoose.disconnect();
    logWithCheckpoint("info", "Disconnected from MongoDB", "SCRIPT_006");
  }
}

// Run the script
main();
