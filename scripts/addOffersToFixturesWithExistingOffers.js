/**
 * Add Offers to Fixtures That Have Existing Offers
 * סקריפט להוספת הצעה לכל משחק שיש לו כבר הצעה אחת
 *
 * This script:
 * 1. Connects to MongoDB database
 * 2. Finds all fixtures that have at least one offer
 * 3. For each fixture, creates an additional offer from a different agent
 *
 * Usage:
 *   node scripts/addOffersToFixturesWithExistingOffers.js
 *
 * Requirements:
 * - At least one active agent must exist in the database
 * - MONGODB_URI must be set in environment variables
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import databaseConnection from "../src/config/database.js";
import FootballEvent from "../src/models/FootballEvent.js";
import Agent from "../src/models/Agent.js";
import Offer from "../src/models/Offer.js";
import Team from "../src/models/Team.js";
import Venue from "../src/models/Venue.js";
import League from "../src/models/League.js";

// Load environment variables
dotenv.config();

class OffersAdder {
  constructor() {
    this.mongoUri = process.env.MONGODB_URI;

    if (!this.mongoUri) {
      throw new Error("MONGODB_URI is required in environment variables");
    }

    // Stats
    this.stats = {
      fixturesFound: 0,
      agentsFound: 0,
      offersCreated: 0,
      offersSkipped: 0,
      errors: [],
    };

    this.agents = [];
    this.currentAgentIndex = 0;
  }

  // Connect to MongoDB
  async connectToDatabase() {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 1] Connecting to MongoDB...");
      console.log("========================================\n");

      await databaseConnection.connect(this.mongoUri);

      if (!databaseConnection.isDatabaseConnected()) {
        throw new Error("Failed to connect to MongoDB");
      }

      console.log("✅ Connected to MongoDB successfully\n");
    } catch (error) {
      console.error("[ERROR] Database connection failed:", error.message);
      throw error;
    }
  }

  // Find all active agents
  async findAllActiveAgents() {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 2] Finding all active agents...");
      console.log("========================================\n");

      this.agents = await Agent.find({ isActive: true }).lean();

      this.stats.agentsFound = this.agents.length;

      if (this.agents.length === 0) {
        throw new Error(
          "No active agents found in database. Please create an active agent first."
        );
      }

      console.log(`✅ Found ${this.agents.length} active agents:\n`);
      this.agents.forEach((agent, index) => {
        console.log(
          `   ${index + 1}. ${agent.name || "N/A"} (${agent.whatsapp})`
        );
      });
      console.log();
    } catch (error) {
      console.error("[ERROR] Failed to find agents:", error.message);
      throw error;
    }
  }

  // Get next agent (round-robin)
  getNextAgent() {
    if (this.agents.length === 0) {
      throw new Error("No agents available");
    }
    const agent = this.agents[this.currentAgentIndex];
    this.currentAgentIndex = (this.currentAgentIndex + 1) % this.agents.length;
    return agent;
  }

  // Find all fixtures that have at least one offer
  async findFixturesWithOffers() {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 3] Finding fixtures with existing offers...");
      console.log("========================================\n");

      // Get all unique fixture IDs that have offers
      const fixturesWithOffers = await Offer.distinct("fixtureId");

      this.stats.fixturesFound = fixturesWithOffers.length;

      console.log(
        `✅ Found ${fixturesWithOffers.length} fixtures with existing offers\n`
      );

      return fixturesWithOffers;
    } catch (error) {
      console.error(
        "[ERROR] Failed to find fixtures with offers:",
        error.message
      );
      throw error;
    }
  }

  // Get fixture details
  async getFixtureDetails(fixtureId) {
    try {
      const fixture = await FootballEvent.findById(fixtureId)
        .populate("homeTeam", "name_en name_he slug")
        .populate("awayTeam", "name_en name_he slug")
        .populate("venue", "name city")
        .populate("league", "name slug")
        .lean();

      return fixture;
    } catch (error) {
      console.error(
        `[ERROR] Failed to get fixture details for ${fixtureId}:`,
        error.message
      );
      return null;
    }
  }

  // Create an offer for a fixture using a different agent
  async createOfferForFixture(fixtureId, fixtureNumber) {
    try {
      const fixture = await this.getFixtureDetails(fixtureId);

      if (!fixture) {
        console.log(
          `  [FIXTURE ${fixtureNumber}] ⚠️  Skipped - Fixture not found`
        );
        this.stats.offersSkipped++;
        return null;
      }

      // Get all agents that already have offers for this fixture
      const existingOffers = await Offer.find({ fixtureId }).lean();
      const agentsWithOffers = existingOffers.map((offer) =>
        offer.agentId.toString()
      );

      // Find an agent that doesn't have an offer for this fixture yet
      let newAgent = null;
      for (const agent of this.agents) {
        if (!agentsWithOffers.includes(agent._id.toString())) {
          newAgent = agent;
          break;
        }
      }

      // If all agents already have offers, use the next available agent
      if (!newAgent) {
        newAgent = this.getNextAgent();
      }

      // Get the existing offers to determine an appropriate price
      const existingPrices = existingOffers
        .map((offer) => offer.price)
        .sort((a, b) => a - b);

      // Create a price that's slightly different from existing ones
      let newPrice;
      if (existingPrices.length > 0) {
        const averagePrice =
          existingPrices.reduce((sum, price) => sum + price, 0) /
          existingPrices.length;
        newPrice = Math.round(averagePrice * 1.1); // 10% higher than average
      } else {
        newPrice = 100; // Default price
      }

      // Check if this exact offer already exists
      const existingOffer = await Offer.findOne({
        fixtureId,
        agentId: newAgent._id,
        price: newPrice,
        currency: "EUR",
      });

      if (existingOffer) {
        console.log(
          `  [FIXTURE ${fixtureNumber}] ⏭️  Skipped - Offer already exists`
        );
        this.stats.offersSkipped++;
        return null;
      }

      // Create new offer
      const newOffer = new Offer({
        fixtureId,
        agentId: newAgent._id,
        price: newPrice,
        currency: "EUR",
        ticketType: "standard",
        isAvailable: true,
      });

      const savedOffer = await newOffer.save();
      this.stats.offersCreated++;

      const matchDate = new Date(fixture.date).toISOString().split("T")[0];
      console.log(
        `  [FIXTURE ${fixtureNumber}] ✅ Created - ${fixture.homeTeam.name_en} vs ${fixture.awayTeam.name_en} (${matchDate}) - Agent: ${newAgent.name} - Price: ${newPrice} EUR`
      );

      return savedOffer;
    } catch (error) {
      console.error(`  [FIXTURE ${fixtureNumber}] ❌ Failed:`, error.message);
      this.stats.errors.push({
        fixtureId,
        reason: error.message,
      });
      return null;
    }
  }

  // Create offers for all fixtures
  async createOffersForAllFixtures(fixtureIds) {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 4] Creating offers for fixtures...");
      console.log("========================================\n");

      for (let i = 0; i < fixtureIds.length; i++) {
        await this.createOfferForFixture(fixtureIds[i], i + 1);
      }

      console.log("\n✅ Finished creating offers for all fixtures\n");
    } catch (error) {
      console.error("[ERROR] Failed to create offers:", error.message);
      throw error;
    }
  }

  // Display summary
  displaySummary() {
    console.log("========================================");
    console.log("[CHECKPOINT 5] Summary");
    console.log("========================================");
    console.log(`Total fixtures with offers: ${this.stats.fixturesFound}`);
    console.log(`Total agents available: ${this.stats.agentsFound}`);
    console.log(`✅ Offers created: ${this.stats.offersCreated}`);
    console.log(`⏭️  Offers skipped: ${this.stats.offersSkipped}`);
    console.log(`❌ Errors: ${this.stats.errors.length}`);
    console.log("========================================\n");

    if (this.stats.errors.length > 0) {
      console.log("========================================");
      console.log("Error Details:");
      console.log("========================================");

      this.stats.errors.forEach((error, index) => {
        console.log(`\n[${index + 1}] Fixture ID: ${error.fixtureId}`);
        console.log(`    Reason: ${error.reason}`);
      });

      console.log("\n========================================\n");
    }
  }

  // Main function
  async run() {
    try {
      console.log("\n⚽ ADD OFFERS TO FIXTURES WITH EXISTING OFFERS ⚽\n");

      // Connect to database
      await this.connectToDatabase();

      // Find all active agents
      await this.findAllActiveAgents();

      // Find fixtures with existing offers
      const fixturesWithOffers = await this.findFixturesWithOffers();

      if (fixturesWithOffers.length === 0) {
        console.log("No fixtures with offers found. Nothing to process.");
        return;
      }

      // Create offers for all fixtures
      await this.createOffersForAllFixtures(fixturesWithOffers);

      // Display summary
      this.displaySummary();

      console.log("✅ Process completed successfully!\n");
    } catch (error) {
      console.error("\n❌ Process failed:", error.message);
      throw error;
    } finally {
      // Disconnect from database
      await databaseConnection.disconnect();
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const adder = new OffersAdder();

  (async () => {
    try {
      await adder.run();
      process.exit(0);
    } catch (error) {
      console.error("❌ Process failed:", error.message);
      process.exit(1);
    }
  })();
}

export default OffersAdder;
