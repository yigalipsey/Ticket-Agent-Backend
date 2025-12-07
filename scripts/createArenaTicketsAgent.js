import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Agent from "../src/models/Agent.js";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

// Load environment variables
dotenv.config();

/**
 * Script to create a new agency: arena tickets
 */

const agentData = {
  email: "office@arenatickets.co.il",
  password: "ArenaTickets2024!@#Champions", // Strong password
  name: "arena tickets",
  companyName: "Arena Tickets",
  whatsapp: "+972526846584",
  websiteUrl: "https://arenatickets.co.il/",
  externalRating: {
    rating: 5.0,
    url: "https://www.google.com/search?q=%D7%90%D7%A8%D7%A0%D7%94+%D7%98%D7%99%D7%A7%D7%98%D7%A1&oq=&gs_lcrp=EgZjaHJvbWUqBggBEEUYOzIGCAAQRRg7MgYIARBFGDsyBwgCEAAYgAQyBwgDEAAYgAQyDQgEEC4YrwEYxwEYgAQyBwgFEAAYgAQyBwgGEAAYgAQyBggHEEUYPdIBCDE5MjFqMGo0qAIAsAIB&sourceid=chrome&ie=UTF-8#lrd=0x151d41e6eb325efb:0xdf15bb6a8f42503f,1,,,,",
    provider: "google",
  },
  agentType: "agency",
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

async function createArenaTicketsAgent() {
  try {
    logWithCheckpoint(
      "info",
      `Creating agency: ${agentData.companyName}`,
      "SCRIPT_003"
    );

    // Check if agent already exists
    const existingAgent = await Agent.findOne({
      $or: [
        { email: agentData.email },
        { whatsapp: agentData.whatsapp },
        { companyName: agentData.companyName },
      ],
    });

    if (existingAgent) {
      logWithCheckpoint(
        "warn",
        `Agency already exists with email: ${agentData.email} or whatsapp: ${agentData.whatsapp}`,
        "SCRIPT_004",
        {
          existingAgentId: existingAgent._id,
          existingEmail: existingAgent.email,
          existingWhatsapp: existingAgent.whatsapp,
          existingCompanyName: existingAgent.companyName,
        }
      );
      return {
        success: false,
        error: "Agency already exists",
        existingAgent: {
          _id: existingAgent._id,
          email: existingAgent.email,
          whatsapp: existingAgent.whatsapp,
          companyName: existingAgent.companyName,
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
      companyName: agentData.companyName,
      whatsapp: agentData.whatsapp,
      websiteUrl: agentData.websiteUrl,
      externalRating: agentData.externalRating,
      agentType: agentData.agentType,
      isActive: agentData.isActive,
    };

    const agent = new Agent(newAgentData);
    await agent.save({ runValidators: true });

    logWithCheckpoint(
      "info",
      `Successfully created agency: ${agent.companyName}`,
      "SCRIPT_005",
      {
        agentId: agent._id,
        email: agent.email,
        whatsapp: agent.whatsapp,
        companyName: agent.companyName,
        websiteUrl: agent.websiteUrl,
        externalRating: agent.externalRating,
      }
    );

    return {
      success: true,
      agent: {
        _id: agent._id,
        email: agent.email,
        name: agent.name,
        companyName: agent.companyName,
        whatsapp: agent.whatsapp,
        websiteUrl: agent.websiteUrl,
        externalRating: agent.externalRating,
        agentType: agent.agentType,
        isActive: agent.isActive,
      },
    };
  } catch (error) {
    logError(error, { operation: "createArenaTicketsAgent", agentData });
    throw error;
  }
}

async function main() {
  try {
    // Connect to database
    await connectToDatabase();

    // Create agency
    const result = await createArenaTicketsAgent();

    if (result.success) {
      console.log("\n✅ Successfully created agency:");
      console.log(`   Name: ${result.agent.name}`);
      console.log(`   Company Name: ${result.agent.companyName}`);
      console.log(`   Email: ${result.agent.email}`);
      console.log(`   WhatsApp: ${result.agent.whatsapp}`);
      console.log(`   Website: ${result.agent.websiteUrl}`);
      console.log(
        `   Rating: ${result.agent.externalRating.rating} (${result.agent.externalRating.provider})`
      );
      console.log(`   Rating URL: ${result.agent.externalRating.url}`);
      console.log(`   ID: ${result.agent._id}`);
      console.log(`   Type: ${result.agent.agentType}`);
      console.log(`   Active: ${result.agent.isActive}`);
      console.log(`\n📧 Email: ${agentData.email}`);
      console.log(`🔐 Password: ${agentData.password}`);
      console.log("\n⚠️  Please save these credentials securely!");
    } else {
      console.log("\n❌ Failed to create agency:");
      if (result.error === "Agency already exists") {
        console.log(`   Agency already exists:`);
        console.log(`   ID: ${result.existingAgent._id}`);
        console.log(`   Email: ${result.existingAgent.email}`);
        console.log(`   WhatsApp: ${result.existingAgent.whatsapp}`);
        console.log(`   Company Name: ${result.existingAgent.companyName}`);
      } else {
        console.log(`   Error: ${result.error}`);
      }
    }
  } catch (error) {
    logError(error, { operation: "main" });
    console.error("❌ Error creating agency:", error.message);
    if (error.code === 11000) {
      console.error(
        "   Duplicate key error - agency with this email or whatsapp already exists"
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
