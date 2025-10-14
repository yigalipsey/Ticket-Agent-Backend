/**
 * Real Madrid Ticket Offers Inserter
 * סקריפט להכנסת הצעות כרטיסים למשחקי ריאל מדריד
 *
 * This script:
 * 1. Connects to MongoDB database
 * 2. Finds Real Madrid team
 * 3. Fetches 10 upcoming Real Madrid fixtures (home or away)
 * 4. Finds an active agent in the database
 * 5. Creates multiple ticket offers for each fixture with different price categories
 *
 * Usage:
 *   npm run insert-real-madrid-offers
 *   or
 *   node scripts/insertRealMadridOffers.js
 *
 * Requirements:
 * - Real Madrid team must exist in the database
 * - At least one active agent must exist in the database
 * - MONGODB_URI must be set in environment variables
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import databaseConnection from "../src/config/database.js";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";
import Agent from "../src/models/Agent.js";
import Offer from "../src/models/Offer.js";
import Venue from "../src/models/Venue.js";
import League from "../src/models/League.js";

// Load environment variables
dotenv.config();

class RealMadridOffersInserter {
  constructor() {
    this.mongoUri = process.env.MONGODB_URI;

    if (!this.mongoUri) {
      throw new Error("MONGODB_URI is required in environment variables");
    }

    // Stats
    this.stats = {
      fixturesFound: 0,
      offersCreated: 0,
      offersSkipped: 0,
      errors: [],
    };

    // Offer templates - different price categories
    this.offerTemplates = [
      {
        price: 150,
        currency: "EUR",
        description: "Category 1 - Premium seats behind the goal",
        source: "direct",
        metadata: {
          seatCategory: "Category 1",
          notes: "Best view, close to the pitch",
        },
      },
      {
        price: 200,
        currency: "EUR",
        description: "Category 2 - Side view premium",
        source: "direct",
        metadata: {
          seatCategory: "Category 2",
          notes: "Excellent side view of the pitch",
        },
      },
      {
        price: 280,
        currency: "EUR",
        description: "VIP - Main stand with lounge access",
        source: "direct",
        metadata: {
          seatCategory: "VIP",
          notes: "Includes lounge access and refreshments",
        },
      },
    ];
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

  // Find Real Madrid team
  async findRealMadrid() {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 2] Finding Real Madrid team...");
      console.log("========================================\n");

      // Try to find by slug first, then by name
      let team = await Team.findOne({ slug: "real-madrid" });

      if (!team) {
        team = await Team.findOne({
          $or: [{ name_en: /Real Madrid/i }, { name_he: /ריאל מדריד/i }],
        });
      }

      if (!team) {
        throw new Error(
          "Real Madrid team not found in database. Please ensure the team exists."
        );
      }

      console.log(`✅ Found team: ${team.name_en} (${team.name_he || "N/A"})`);
      console.log(`   Slug: ${team.slug}`);
      console.log(`   Team ID: ${team._id}\n`);

      return team;
    } catch (error) {
      console.error("[ERROR] Failed to find Real Madrid:", error.message);
      throw error;
    }
  }

  // Find active agent
  async findActiveAgent() {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 3] Finding active agent...");
      console.log("========================================\n");

      const agent = await Agent.findOne({ isActive: true });

      if (!agent) {
        throw new Error(
          "No active agent found in database. Please create an active agent first."
        );
      }

      console.log(`✅ Found agent: ${agent.name || "N/A"}`);
      console.log(`   WhatsApp: ${agent.whatsapp}`);
      console.log(`   Agent ID: ${agent._id}\n`);

      return agent;
    } catch (error) {
      console.error("[ERROR] Failed to find active agent:", error.message);
      throw error;
    }
  }

  // Get Real Madrid fixtures
  async getRealMadridFixtures(teamId, limit = 10) {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 4] Fetching Real Madrid fixtures...");
      console.log(`Limit: ${limit} fixtures`);
      console.log("========================================\n");

      // Find upcoming fixtures where Real Madrid is home or away
      const fixtures = await FootballEvent.find({
        $or: [{ homeTeam: teamId }, { awayTeam: teamId }],
        date: { $gte: new Date() }, // Future matches only
      })
        .populate("homeTeam", "name_en name_he slug")
        .populate("awayTeam", "name_en name_he slug")
        .populate("venue", "name city")
        .populate("league", "name")
        .sort({ date: 1 }) // Sort by date ascending (nearest first)
        .limit(limit)
        .lean();

      this.stats.fixturesFound = fixtures.length;

      if (fixtures.length === 0) {
        console.log("⚠️  No upcoming fixtures found for Real Madrid\n");
      } else {
        console.log(`✅ Found ${fixtures.length} upcoming fixtures\n`);
      }

      return fixtures;
    } catch (error) {
      console.error("[ERROR] Failed to fetch fixtures:", error.message);
      throw error;
    }
  }

  // Create offers for a single fixture
  async createOffersForFixture(fixture, agent, fixtureNumber) {
    try {
      console.log(`\n----------------------------------------`);
      console.log(`[FIXTURE ${fixtureNumber}] Creating offers...`);
      console.log(`----------------------------------------`);

      const matchDate = new Date(fixture.date).toISOString().split("T")[0];
      const matchTime = new Date(fixture.date).toTimeString().substring(0, 5);

      console.log(
        `Match: ${fixture.homeTeam.name_en} vs ${fixture.awayTeam.name_en}`
      );
      console.log(`Date: ${matchDate} at ${matchTime}`);
      console.log(`Venue: ${fixture.venue?.name || "TBD"}`);
      console.log(`League: ${fixture.league?.name || "N/A"}\n`);

      const createdOffers = [];

      // Create offers based on templates
      for (let i = 0; i < this.offerTemplates.length; i++) {
        const template = this.offerTemplates[i];

        try {
          // Check if similar offer already exists
          const existingOffer = await Offer.findOne({
            fixtureId: fixture._id,
            agentId: agent._id,
            price: template.price,
            currency: template.currency,
          });

          if (existingOffer) {
            console.log(
              `  [${i + 1}/${this.offerTemplates.length}] ⏭️  Skipped - ${
                template.description
              } (${template.price} ${template.currency}) - already exists`
            );
            this.stats.offersSkipped++;
            continue;
          }

          // Create new offer
          const newOffer = new Offer({
            fixtureId: fixture._id,
            agentId: agent._id,
            price: template.price,
            currency: template.currency,
            description: template.description,
            source: template.source,
            metadata: template.metadata,
            isAvailable: true,
          });

          const savedOffer = await newOffer.save();
          createdOffers.push(savedOffer);
          this.stats.offersCreated++;

          console.log(
            `  [${i + 1}/${this.offerTemplates.length}] ✅ Created - ${
              template.description
            } (${template.price} ${template.currency})`
          );
        } catch (error) {
          console.error(
            `  [${i + 1}/${this.offerTemplates.length}] ❌ Failed - ${
              template.description
            }:`,
            error.message
          );
          this.stats.errors.push({
            fixtureId: fixture._id,
            template: template.description,
            reason: error.message,
          });
        }
      }

      console.log(
        `\n✅ Created ${createdOffers.length} offers for this fixture`
      );

      return createdOffers;
    } catch (error) {
      console.error(
        `[ERROR] Failed to create offers for fixture:`,
        error.message
      );
      this.stats.errors.push({
        fixtureId: fixture._id,
        reason: error.message,
      });
      return [];
    }
  }

  // Create offers for all fixtures
  async createAllOffers(fixtures, agent) {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 5] Creating offers for fixtures...");
      console.log("========================================\n");

      for (let i = 0; i < fixtures.length; i++) {
        const fixture = fixtures[i];
        await this.createOffersForFixture(fixture, agent, i + 1);
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
    console.log("[CHECKPOINT 6] Summary");
    console.log("========================================");
    console.log(`Total fixtures found: ${this.stats.fixturesFound}`);
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
        if (error.template) console.log(`    Template: ${error.template}`);
        console.log(`    Reason: ${error.reason}`);
      });

      console.log("\n========================================\n");
    }
  }

  // Main function
  async run() {
    try {
      console.log("\n⚽ REAL MADRID TICKET OFFERS INSERTER ⚽\n");

      // Connect to database
      await this.connectToDatabase();

      // Find Real Madrid team
      const realMadrid = await this.findRealMadrid();

      // Find active agent
      const agent = await this.findActiveAgent();

      // Get Real Madrid fixtures (10 upcoming matches)
      const fixtures = await this.getRealMadridFixtures(realMadrid._id, 10);

      if (fixtures.length === 0) {
        console.log("No fixtures found. Nothing to process.");
        return;
      }

      // Create offers for all fixtures
      await this.createAllOffers(fixtures, agent);

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
  const inserter = new RealMadridOffersInserter();

  (async () => {
    try {
      await inserter.run();
      process.exit(0);
    } catch (error) {
      console.error("❌ Process failed:", error.message);
      process.exit(1);
    }
  })();
}

export default RealMadridOffersInserter;
