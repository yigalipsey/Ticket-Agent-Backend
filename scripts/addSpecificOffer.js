/**
 * Add specific offer to fixture
 * סקריפט להוספת הצעה ספציפית למשחק
 *
 * This script adds a specific offer to a fixture by a specific agent
 *
 * Usage:
 *   node scripts/addSpecificOffer.js
 *
 * Requirements:
 * - MONGODB_URI must be set in environment variables
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import databaseConnection from "../src/config/database.js";
import FootballEvent from "../src/models/FootballEvent.js";
import Agent from "../src/models/Agent.js";
import Offer from "../src/models/Offer.js";

// Load environment variables
dotenv.config();

// Configuration
const CONFIG = {
  FIXTURE_ID: "68e79edd4a00e38f56da077c",
  AGENT_ID: "68ee4f9ef233c26ce400cb9f",
  PRICE: 1250,
  CURRENCY: "ILS",
};

async function addOffer() {
  try {
    console.log("========================================");
    console.log("Adding specific offer to fixture");
    console.log("========================================\n");
    console.log("Fixture ID:", CONFIG.FIXTURE_ID);
    console.log("Agent ID:", CONFIG.AGENT_ID);
    console.log("Price:", CONFIG.PRICE, CONFIG.CURRENCY);
    console.log("\n");

    // Connect to database
    console.log("[STEP 1] Connecting to MongoDB...");
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI is required in environment variables");
    }

    await databaseConnection.connect(mongoUri);

    if (!databaseConnection.isDatabaseConnected()) {
      throw new Error("Failed to connect to MongoDB");
    }

    console.log("✅ Connected to MongoDB successfully\n");

    // Validate fixture exists
    console.log("[STEP 2] Validating fixture...");
    const fixture = await FootballEvent.findById(CONFIG.FIXTURE_ID);

    if (!fixture) {
      throw new Error(`Fixture with ID ${CONFIG.FIXTURE_ID} not found`);
    }

    console.log("✅ Fixture found:");
    console.log(`   - ${fixture.homeTeam} vs ${fixture.awayTeam}`);
    console.log(`   - Date: ${fixture.date}\n`);

    // Validate agent exists
    console.log("[STEP 3] Validating agent...");
    const agent = await Agent.findById(CONFIG.AGENT_ID);

    if (!agent) {
      throw new Error(`Agent with ID ${CONFIG.AGENT_ID} not found`);
    }

    if (!agent.isActive) {
      throw new Error(`Agent ${CONFIG.AGENT_ID} is not active`);
    }

    console.log("✅ Agent found:");
    console.log(`   - Name: ${agent.name}`);
    console.log(`   - Active: ${agent.isActive}\n`);

    // Delete any existing offers by this agent for this fixture
    console.log("[STEP 4] Checking for existing offers...");
    const existingOffers = await Offer.find({
      fixtureId: CONFIG.FIXTURE_ID,
      agentId: CONFIG.AGENT_ID,
    });

    if (existingOffers.length > 0) {
      console.log(
        `   Found ${existingOffers.length} existing offer(s), deleting...`
      );
      await Offer.deleteMany({
        fixtureId: CONFIG.FIXTURE_ID,
        agentId: CONFIG.AGENT_ID,
      });
      console.log("   ✅ Existing offers deleted\n");
    } else {
      console.log("   No existing offers found\n");
    }

    // Create new offer
    console.log("[STEP 5] Creating new offer...");
    const newOffer = new Offer({
      fixtureId: CONFIG.FIXTURE_ID,
      agentId: CONFIG.AGENT_ID,
      price: CONFIG.PRICE,
      currency: CONFIG.CURRENCY,
      ticketType: "standard",
      isAvailable: true,
    });

    const savedOffer = await newOffer.save();

    console.log("✅ Offer created successfully!");
    console.log("   Offer ID:", savedOffer._id);
    console.log("   Price:", savedOffer.price, savedOffer.currency);
    console.log("   Ticket Type:", savedOffer.ticketType);
    console.log("   Available:", savedOffer.isAvailable);
    console.log("\n");

    console.log("========================================");
    console.log("✅ Script completed successfully");
    console.log("========================================");

    // Disconnect from database
    await databaseConnection.disconnect();
    console.log("Disconnected from MongoDB\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error occurred:", error.message);
    console.error(error);

    // Disconnect from database
    try {
      await databaseConnection.disconnect();
    } catch (disconnectError) {
      console.error("Error disconnecting:", disconnectError.message);
    }

    process.exit(1);
  }
}

// Run the script
addOffer();
