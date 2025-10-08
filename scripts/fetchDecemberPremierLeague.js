import dotenv from "dotenv";
import axios from "axios";

// Load environment variables
dotenv.config();

class DecemberPremierLeagueFetcher {
  constructor() {
    this.apiFootballKey = process.env.API_FOOTBALL_KEY;
    this.apiFootballBaseUrl =
      process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";

    if (!this.apiFootballKey) {
      throw new Error("API_FOOTBALL_KEY is required in environment variables");
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
    this.season = 2025; // Current season

    // December date range (you can modify the year as needed)
    this.decemberStart = "2025-12-01";
    this.decemberEnd = "2025-12-31";
  }

  // Fetch fixtures for December
  async fetchDecemberFixtures() {
    try {
      console.log("========================================");
      console.log(
        "[CHECKPOINT 1] Starting December Premier League fixtures fetch..."
      );
      console.log(`Date Range: ${this.decemberStart} to ${this.decemberEnd}`);
      console.log(`League ID: ${this.premierLeagueId}`);
      console.log(`Season: ${this.season}`);
      console.log("========================================\n");

      console.log("[CHECKPOINT 2] Sending API request...");

      const response = await this.apiClient.get("/fixtures", {
        params: {
          league: this.premierLeagueId,
          season: this.season,
          from: this.decemberStart,
          to: this.decemberEnd,
        },
      });

      console.log("[CHECKPOINT 3] API response received.");

      if (response.data && response.data.response) {
        const fixtures = response.data.response;
        console.log(
          `[CHECKPOINT 4] Found ${fixtures.length} fixtures in December`
        );
        return fixtures;
      } else {
        console.log("[CHECKPOINT 4] No fixtures found in December");
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

  // Display fixtures information
  displayFixtures(fixtures) {
    console.log("\n========================================");
    console.log("[CHECKPOINT 5] Displaying December Fixtures");
    console.log("========================================");
    console.log(`Total fixtures: ${fixtures.length}\n`);

    if (fixtures.length === 0) {
      console.log("No fixtures found for December.");
      return;
    }

    // Group fixtures by date
    const fixturesByDate = {};
    fixtures.forEach((fixture) => {
      const date = new Date(fixture.fixture.date).toISOString().split("T")[0];
      if (!fixturesByDate[date]) {
        fixturesByDate[date] = [];
      }
      fixturesByDate[date].push(fixture);
    });

    // Display by date
    let fixtureNumber = 1;
    Object.keys(fixturesByDate)
      .sort()
      .forEach((date) => {
        const formattedDate = new Date(date).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        console.log(`\n========================================`);
        console.log(`📅 ${formattedDate}`);
        console.log(`========================================`);

        fixturesByDate[date].forEach((fixture) => {
          const time = new Date(fixture.fixture.date).toLocaleTimeString(
            "en-US",
            {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }
          );
          const status = fixture.fixture.status.long;
          const homeTeam = fixture.teams.home.name;
          const awayTeam = fixture.teams.away.name;
          const venue = fixture.fixture.venue?.name || "Unknown";

          console.log(`\n--- [MATCH #${fixtureNumber}] ---`);
          console.log(`⚽ ${homeTeam} vs ${awayTeam}`);
          console.log(`🕐 Time: ${time}`);
          console.log(`📍 Venue: ${venue}`);
          console.log(`📊 Status: ${status}`);
          console.log(`🆔 Fixture ID: ${fixture.fixture.id}`);
          console.log(`🏠 Home Team ID: ${fixture.teams.home.id}`);
          console.log(`✈️  Away Team ID: ${fixture.teams.away.id}`);

          if (fixture.fixture.venue?.id) {
            console.log(`🏟️  Venue ID: ${fixture.fixture.venue.id}`);
          }

          // Display score if match has been played
          if (fixture.goals.home !== null && fixture.goals.away !== null) {
            console.log(
              `⚽ Score: ${fixture.goals.home} - ${fixture.goals.away}`
            );
          }

          fixtureNumber++;
        });
      });
  }

  // Main function to fetch and display all fixtures
  async fetchAndDisplayAllFixtures() {
    try {
      console.log("\n🏴󠁧󠁢󠁥󠁮󠁧󠁿 PREMIER LEAGUE - DECEMBER FIXTURES 🏴󠁧󠁢󠁥󠁮󠁧󠁿\n");

      // Fetch all fixtures
      const fixtures = await this.fetchDecemberFixtures();

      // Display fixtures
      this.displayFixtures(fixtures);

      console.log("\n========================================");
      console.log("[CHECKPOINT 6] Summary");
      console.log("========================================");
      console.log(`Total December fixtures: ${fixtures.length}`);
      console.log(`Date range: ${this.decemberStart} to ${this.decemberEnd}`);
      console.log("========================================\n");

      return fixtures;
    } catch (error) {
      console.error("\n[ERROR] Fetch failed:", error.message);
      throw error;
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const fetcher = new DecemberPremierLeagueFetcher();

  (async () => {
    try {
      await fetcher.fetchAndDisplayAllFixtures();
      console.log("✅ Fetch completed successfully!\n");
    } catch (error) {
      console.error("❌ Fetch failed:", error.message);
      process.exit(1);
    }
  })();
}

export default DecemberPremierLeagueFetcher;
