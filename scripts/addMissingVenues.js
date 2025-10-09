import dotenv from "dotenv";
import axios from "axios";
import mongoose from "mongoose";
import databaseConnection from "../src/config/database.js";
import Venue from "../src/models/Venue.js";

// Load environment variables
dotenv.config();

class MissingVenuesAdder {
  constructor() {
    this.apiFootballKey = process.env.API_FOOTBALL_KEY;
    this.apiFootballBaseUrl =
      process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";
    this.mongoUri = process.env.MONGODB_URI;

    if (!this.apiFootballKey) {
      throw new Error("API_FOOTBALL_KEY is required in environment variables");
    }

    if (!this.mongoUri) {
      throw new Error("MONGODB_URI is required in environment variables");
    }

    this.apiClient = axios.create({
      baseURL: this.apiFootballBaseUrl,
      headers: {
        "X-RapidAPI-Key": this.apiFootballKey,
        "X-RapidAPI-Host": "v3.football.api-sports.io",
      },
      timeout: 30000,
    });

    // La Liga league ID
    this.laLigaId = 140;
    this.season = 2025;

    // Date range
    this.startDate = "2025-10-09";
    this.endDate = "2026-05-25";

    // Stats
    this.stats = {
      fetched: 0,
      checked: 0,
      added: 0,
      existing: 0,
      errors: [],
    };
  }

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

  async fetchFixtures() {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 2] Fetching La Liga fixtures from API...");
      console.log("========================================\n");

      const response = await this.apiClient.get("/fixtures", {
        params: {
          league: this.laLigaId,
          season: this.season,
          from: this.startDate,
          to: this.endDate,
        },
      });

      if (response.data && response.data.response) {
        const fixtures = response.data.response;
        this.stats.fetched = fixtures.length;
        console.log(`✅ Found ${fixtures.length} fixtures\n`);
        return fixtures;
      } else {
        console.log("⚠️ No fixtures found\n");
        return [];
      }
    } catch (error) {
      console.error("[ERROR] Failed to fetch fixtures:", error.message);
      throw error;
    }
  }

  createSlug(name) {
    return name
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }

  async addVenueIfMissing(venueData) {
    try {
      const venueId = venueData.id;
      const venueName = venueData.name;
      const venueCity = venueData.city;

      this.stats.checked++;

      // Check if venue exists
      const existingVenue = await Venue.findOne({
        "externalIds.apiFootball": venueId,
      });

      if (existingVenue) {
        this.stats.existing++;
        return { action: "exists", venue: existingVenue };
      }

      // Create new venue
      const newVenue = new Venue({
        name_en: venueName,
        name_he: venueName, // Can be translated later
        city_en: venueCity || "Unknown",
        city_he: venueCity || "Unknown",
        country_en: "Spain",
        country_he: "ספרד",
        capacity: venueData.capacity || 0,
        address_en: venueData.address || "",
        image: venueData.image || "",
        venueId: venueId,
        externalIds: {
          apiFootball: venueId,
        },
      });

      await newVenue.save();
      this.stats.added++;

      console.log(`➕ Added: ${venueName} (ID: ${venueId})`);

      return { action: "added", venue: newVenue };
    } catch (error) {
      console.error(
        `[ERROR] Failed to add venue ${venueData.name}:`,
        error.message
      );
      this.stats.errors.push({
        venueId: venueData.id,
        venueName: venueData.name,
        error: error.message,
      });
      return null;
    }
  }

  async processFixtures(fixtures) {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 3] Processing venues from fixtures...");
      console.log("========================================\n");

      const uniqueVenues = new Map();

      // Collect unique venues
      fixtures.forEach((fixture) => {
        const venue = fixture.fixture.venue;
        if (venue && venue.id) {
          if (!uniqueVenues.has(venue.id)) {
            uniqueVenues.set(venue.id, venue);
          }
        }
      });

      console.log(`Found ${uniqueVenues.size} unique venues in fixtures\n`);

      // Process each venue
      for (const [venueId, venueData] of uniqueVenues) {
        await this.addVenueIfMissing(venueData);
      }

      console.log("\n✅ All venues processed\n");
    } catch (error) {
      console.error("[ERROR] Failed to process venues:", error.message);
      throw error;
    }
  }

  displaySummary() {
    console.log("========================================");
    console.log("[CHECKPOINT 4] Summary");
    console.log("========================================");
    console.log(`Total fixtures fetched: ${this.stats.fetched}`);
    console.log(`Venues checked: ${this.stats.checked}`);
    console.log(`➕ Venues added: ${this.stats.added}`);
    console.log(`✅ Already existing: ${this.stats.existing}`);
    console.log(`❌ Errors: ${this.stats.errors.length}`);
    console.log("========================================\n");

    if (this.stats.errors.length > 0) {
      console.log("========================================");
      console.log("Error Details:");
      console.log("========================================");
      this.stats.errors.forEach((error, index) => {
        console.log(`\n[Error #${index + 1}]`);
        console.log(`Venue: ${error.venueName}`);
        console.log(`Venue ID: ${error.venueId}`);
        console.log(`Error: ${error.error}`);
      });
      console.log("\n========================================\n");
    }
  }

  async run() {
    try {
      console.log("\n🏟️  ADDING MISSING LA LIGA VENUES 🏟️\n");

      // Connect to database
      await this.connectToDatabase();

      // Fetch fixtures from API
      const fixtures = await this.fetchFixtures();

      if (fixtures.length === 0) {
        console.log("No fixtures to process.");
        return;
      }

      // Process venues
      await this.processFixtures(fixtures);

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
  const adder = new MissingVenuesAdder();

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

export default MissingVenuesAdder;
