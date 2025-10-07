import dotenv from "dotenv";
import axios from "axios";

// Load environment variables
dotenv.config();

class PremierLeagueFetcher {
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
    this.season = 2025; // Season 2025
    this.rounds = [10, 12]; // Rounds to fetch
  }

  // Fetch fixtures for specific rounds
  async fetchFixturesForRounds() {
    try {
      console.log(
        `Fetching Premier League fixtures for rounds ${this.rounds.join(
          ", "
        )}...`
      );

      const allFixtures = [];

      for (const round of this.rounds) {
        console.log(`Fetching round ${round}...`);

        const response = await this.apiClient.get("/fixtures", {
          params: {
            league: this.premierLeagueId,
            season: this.season,
            round: `Regular Season - ${round}`,
          },
        });

        if (response.data && response.data.response) {
          console.log(
            `Found ${response.data.response.length} fixtures for round ${round}`
          );
          allFixtures.push(...response.data.response);
        } else {
          console.log(`No fixtures found for round ${round}`);
        }
      }

      console.log(`Total fixtures found: ${allFixtures.length}`);
      return allFixtures;
    } catch (error) {
      console.error("Error fetching fixtures:", error.message);
      throw error;
    }
  }

  // Display fixtures information
  async displayFixtures(fixtures) {
    console.log(
      `\n=== Premier League Fixtures - Rounds ${this.rounds.join(", ")} ===`
    );
    console.log(`Total fixtures: ${fixtures.length}\n`);

    if (fixtures.length === 0) {
      console.log("No fixtures found for these rounds.");
      return;
    }

    // Group fixtures by round
    const fixturesByRound = {};
    fixtures.forEach((fixture) => {
      const round = fixture.league.round || "Unknown";
      if (!fixturesByRound[round]) {
        fixturesByRound[round] = [];
      }
      fixturesByRound[round].push(fixture);
    });

    // Display by rounds
    Object.keys(fixturesByRound)
      .sort()
      .forEach((round) => {
        console.log(`\n--- ${round} ---`);
        fixturesByRound[round].forEach((fixture) => {
          const date = new Date(fixture.fixture.date).toLocaleDateString(
            "he-IL"
          );
          const time = new Date(fixture.fixture.date).toLocaleTimeString(
            "he-IL",
            {
              hour: "2-digit",
              minute: "2-digit",
            }
          );
          const status = fixture.fixture.status.short;

          console.log(
            `${fixture.teams.home.name} vs ${fixture.teams.away.name}`
          );
          console.log(`  Date: ${date} at ${time}`);
          console.log(`  Status: ${status}`);
          console.log(`  Venue: ${fixture.venue?.name || "Unknown"}`);
          console.log(`  Fixture ID: ${fixture.fixture.id}`);
          console.log(`  Home Team ID: ${fixture.teams.home.id}`);
          console.log(`  Away Team ID: ${fixture.teams.away.id}`);
          console.log(`  Venue ID: ${fixture.venue?.id || "N/A"}`);
          console.log("");
        });
      });
  }

  // Main function to fetch and display all fixtures
  async fetchAndDisplayAllFixtures() {
    try {
      console.log(
        `Starting to fetch Premier League fixtures for rounds ${this.rounds.join(
          ", "
        )}...`
      );

      // Fetch all fixtures
      const fixtures = await this.fetchFixturesForRounds();

      // Display fixtures
      await this.displayFixtures(fixtures);

      console.log(`\n=== Summary ===`);
      console.log(`Total fixtures: ${fixtures.length}`);

      return fixtures;
    } catch (error) {
      console.error("Fetch failed:", error.message);
      throw error;
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const fetcher = new PremierLeagueFetcher();

  (async () => {
    try {
      await fetcher.fetchAndDisplayAllFixtures();
      console.log("\nFetch completed successfully!");
    } catch (error) {
      console.error("Fetch failed:", error.message);
      process.exit(1);
    }
  })();
}

export default PremierLeagueFetcher;
