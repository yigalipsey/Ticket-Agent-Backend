import dotenv from "dotenv";
import axios from "axios";
import mongoose from "mongoose";
import databaseConnection from "../src/config/database.js";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";
import Venue from "../src/models/Venue.js";
import League from "../src/models/League.js";

// Load environment variables
dotenv.config();

class PremierLeague2025Inserter {
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

    // Premier League league ID in API Football
    this.premierLeagueId = 39;
    this.season = 2025;

    // Date range: March to December 2025
    this.startDate = "2025-03-01";
    this.endDate = "2025-12-31";

    // Stats
    this.stats = {
      fetched: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };
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

  // Fetch fixtures for date range
  async fetchFixtures() {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 2] Fetching fixtures from API...");
      console.log(`Date Range: ${this.startDate} to ${this.endDate}`);
      console.log(`League ID: ${this.premierLeagueId}`);
      console.log(`Season: ${this.season}`);
      console.log("========================================\n");

      const response = await this.apiClient.get("/fixtures", {
        params: {
          league: this.premierLeagueId,
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
      if (error.response) {
        console.error("API Error Response:", error.response.data);
      }
      throw error;
    }
  }

  // Create slug for fixture
  createFixtureSlug(homeTeamSlug, awayTeamSlug, date) {
    const dateStr = new Date(date).toISOString().split("T")[0];
    return `${homeTeamSlug}-vs-${awayTeamSlug}-${dateStr}`;
  }

  // Get team by API Football ID
  async findTeamByApiFootballId(apiFootballId, teamName) {
    try {
      const team = await Team.findOne({
        "externalIds.apiFootball": apiFootballId,
      });

      if (!team) {
        console.log(
          `⚠️ Team not found: ${teamName} (API ID: ${apiFootballId})`
        );
        return null;
      }

      return team;
    } catch (error) {
      console.error(`[ERROR] Error finding team ${teamName}:`, error.message);
      return null;
    }
  }

  // Get venue by API Football ID
  async findVenueByApiFootballId(apiFootballId, venueName) {
    try {
      const venue = await Venue.findOne({
        "externalIds.apiFootball": apiFootballId,
      });

      if (!venue) {
        console.log(
          `⚠️ Venue not found: ${venueName} (API ID: ${apiFootballId})`
        );
        return null;
      }

      return venue;
    } catch (error) {
      console.error(`[ERROR] Error finding venue ${venueName}:`, error.message);
      return null;
    }
  }

  // Get league by API Football ID
  async findLeagueByApiFootballId(apiFootballId) {
    try {
      const league = await League.findOne({
        "externalIds.apiFootball": apiFootballId,
      });

      if (!league) {
        console.log(`⚠️ League not found (API ID: ${apiFootballId})`);
        return null;
      }

      return league;
    } catch (error) {
      console.error(`[ERROR] Error finding league:`, error.message);
      return null;
    }
  }

  // Extract round number from round string
  extractRoundNumber(roundString) {
    if (!roundString) return null;
    const match = roundString.match(/Regular Season - (\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  // Insert or update single fixture
  async insertOrUpdateFixture(fixture, league) {
    try {
      const fixtureId = fixture.fixture.id;
      const homeTeamApiId = fixture.teams.home.id;
      const awayTeamApiId = fixture.teams.away.id;
      const venueApiId = fixture.fixture.venue?.id;

      // Find teams
      const homeTeam = await this.findTeamByApiFootballId(
        homeTeamApiId,
        fixture.teams.home.name
      );
      const awayTeam = await this.findTeamByApiFootballId(
        awayTeamApiId,
        fixture.teams.away.name
      );

      if (!homeTeam || !awayTeam) {
        this.stats.skipped++;
        this.stats.errors.push({
          fixtureId,
          reason: "Missing team(s) in database",
          homeTeam: fixture.teams.home.name,
          awayTeam: fixture.teams.away.name,
        });
        return null;
      }

      // Find venue
      let venue = null;
      if (venueApiId) {
        venue = await this.findVenueByApiFootballId(
          venueApiId,
          fixture.fixture.venue.name
        );
      }

      if (!venue) {
        this.stats.skipped++;
        this.stats.errors.push({
          fixtureId,
          reason: "Missing venue in database",
          venue: fixture.fixture.venue?.name || "Unknown",
        });
        return null;
      }

      // Create slug
      const slug = this.createFixtureSlug(
        homeTeam.slug,
        awayTeam.slug,
        fixture.fixture.date
      );

      // Extract round number
      const roundNumber = this.extractRoundNumber(fixture.league.round);

      // Prepare fixture data
      const fixtureData = {
        date: new Date(fixture.fixture.date),
        status: fixture.fixture.status.long,
        league: league._id,
        homeTeam: homeTeam._id,
        awayTeam: awayTeam._id,
        venue: venue._id,
        round: fixture.league.round,
        roundNumber: roundNumber,
        slug: slug,
        externalIds: {
          apiFootball: fixtureId,
        },
      };

      // Check if fixture already exists
      const existingFixture = await FootballEvent.findOne({
        "externalIds.apiFootball": fixtureId,
      });

      if (existingFixture) {
        // Update existing fixture
        await FootballEvent.updateOne(
          { _id: existingFixture._id },
          { $set: fixtureData }
        );
        this.stats.updated++;
        return { action: "updated", fixture: existingFixture };
      } else {
        // Insert new fixture
        const newFixture = new FootballEvent(fixtureData);
        await newFixture.save();
        this.stats.inserted++;
        return { action: "inserted", fixture: newFixture };
      }
    } catch (error) {
      console.error(
        `[ERROR] Error processing fixture ${fixture.fixture.id}:`,
        error.message
      );
      this.stats.errors.push({
        fixtureId: fixture.fixture.id,
        reason: error.message,
      });
      return null;
    }
  }

  // Insert all fixtures
  async insertAllFixtures(fixtures) {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 3] Finding Premier League in database...");
      console.log("========================================\n");

      // Find Premier League
      const league = await this.findLeagueByApiFootballId(this.premierLeagueId);

      if (!league) {
        throw new Error(
          "Premier League not found in database. Please ensure it exists first."
        );
      }

      console.log(`✅ Found league: ${league.name} (${league.nameHe})\n`);

      console.log("========================================");
      console.log("[CHECKPOINT 4] Inserting fixtures to MongoDB...");
      console.log("========================================\n");

      let processedCount = 0;
      const totalFixtures = fixtures.length;

      // Display progress every 10 fixtures
      for (const fixture of fixtures) {
        processedCount++;
        const result = await this.insertOrUpdateFixture(fixture, league);

        // Display progress
        if (processedCount % 10 === 0 || processedCount === totalFixtures) {
          const percentage = ((processedCount / totalFixtures) * 100).toFixed(
            1
          );
          console.log(
            `📊 Progress: ${processedCount}/${totalFixtures} (${percentage}%) - Inserted: ${this.stats.inserted}, Updated: ${this.stats.updated}, Skipped: ${this.stats.skipped}`
          );
        }

        if (result) {
          const action = result.action === "inserted" ? "➕" : "🔄";
          const date = new Date(fixture.fixture.date)
            .toISOString()
            .split("T")[0];
          console.log(
            `${action} ${fixture.teams.home.name} vs ${fixture.teams.away.name} (${date})`
          );
        } else {
          const date = new Date(fixture.fixture.date)
            .toISOString()
            .split("T")[0];
          console.log(
            `⏭️  ${fixture.teams.home.name} vs ${fixture.teams.away.name} (${date}) - skipped`
          );
        }
      }

      console.log("\n✅ All fixtures processed\n");
    } catch (error) {
      console.error("[ERROR] Failed to insert fixtures:", error.message);
      throw error;
    }
  }

  // Display summary by month
  displaySummary() {
    console.log("========================================");
    console.log("[CHECKPOINT 5] Summary");
    console.log("========================================");
    console.log(`Date Range: ${this.startDate} to ${this.endDate}`);
    console.log(`Total fixtures fetched: ${this.stats.fetched}`);
    console.log(`✅ Inserted: ${this.stats.inserted}`);
    console.log(`🔄 Updated: ${this.stats.updated}`);
    console.log(`⏭️  Skipped: ${this.stats.skipped}`);
    console.log(`❌ Errors: ${this.stats.errors.length}`);
    console.log("========================================\n");

    if (this.stats.errors.length > 0) {
      console.log("========================================");
      console.log("Error Details:");
      console.log("========================================");

      // Group errors by reason
      const errorsByReason = {};
      this.stats.errors.forEach((error) => {
        const reason = error.reason;
        if (!errorsByReason[reason]) {
          errorsByReason[reason] = [];
        }
        errorsByReason[reason].push(error);
      });

      Object.keys(errorsByReason).forEach((reason) => {
        console.log(`\n[${reason}] - ${errorsByReason[reason].length} errors`);
        errorsByReason[reason].slice(0, 5).forEach((error, index) => {
          console.log(`  ${index + 1}. Fixture ID: ${error.fixtureId}`);
          if (error.homeTeam) console.log(`     Home: ${error.homeTeam}`);
          if (error.awayTeam) console.log(`     Away: ${error.awayTeam}`);
          if (error.venue) console.log(`     Venue: ${error.venue}`);
        });
        if (errorsByReason[reason].length > 5) {
          console.log(`  ... and ${errorsByReason[reason].length - 5} more`);
        }
      });
      console.log("\n========================================\n");
    }
  }

  // Main function
  async run() {
    try {
      console.log(
        "\n🏴󠁧󠁢󠁥󠁮󠁧󠁿 INSERTING PREMIER LEAGUE 2025 FIXTURES (MARCH - DECEMBER) 🏴󠁧󠁢󠁥󠁮󠁧󠁿\n"
      );

      // Connect to database
      await this.connectToDatabase();

      // Fetch fixtures from API
      const fixtures = await this.fetchFixtures();

      if (fixtures.length === 0) {
        console.log("No fixtures to insert.");
        return;
      }

      // Insert fixtures
      await this.insertAllFixtures(fixtures);

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
  const inserter = new PremierLeague2025Inserter();

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

export default PremierLeague2025Inserter;

