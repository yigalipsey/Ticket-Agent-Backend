import dotenv from "dotenv";
import axios from "axios";

// Load environment variables
dotenv.config();

class ChampionsLeagueFetcher {
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

    // Champions League league ID in API Football
    this.championsLeagueId = 2;
    this.season = 2025; // Season 2025
  }

  // Fetch all fixtures for Champions League 2025
  async fetchAllFixtures() {
    try {
      console.log(`מביא משחקי ליגת האלופות ${this.season}...`);

      const response = await this.apiClient.get("/fixtures", {
        params: {
          league: this.championsLeagueId,
          season: this.season,
        },
      });

      if (response.data && response.data.response) {
        console.log(`נמצאו ${response.data.response.length} משחקים`);
        return response.data.response;
      } else {
        console.log("לא נמצאו משחקים לעונה זו");
        return [];
      }
    } catch (error) {
      console.error("שגיאה במשיכת המשחקים:", error.message);
      throw error;
    }
  }

  // Display fixtures information
  async displayFixtures(fixtures) {
    console.log(`\n=== משחקי ליגת האלופות ${this.season} ===`);
    console.log(`סה"כ משחקים: ${fixtures.length}\n`);

    if (fixtures.length === 0) {
      console.log("לא נמצאו משחקים לעונה זו.");
      return;
    }

    // Group fixtures by round
    const fixturesByRound = {};
    fixtures.forEach((fixture) => {
      const round = fixture.league.round || "לא ידוע";
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
          console.log(`  תאריך: ${date} בשעה ${time}`);
          console.log(`  סטטוס: ${status}`);
          console.log(`  אצטדיון: ${fixture.venue?.name || "לא ידוע"}`);
          console.log(`  מזהה משחק: ${fixture.fixture.id}`);
          console.log("");
        });
      });
  }

  // Main function to fetch and display all fixtures
  async fetchAndDisplayAllFixtures() {
    try {
      console.log(`מתחיל למשוך את כל משחקי ליגת האלופות ${this.season}...`);

      // Fetch all fixtures
      const fixtures = await this.fetchAllFixtures();

      // Display fixtures
      await this.displayFixtures(fixtures);

      console.log(`\n=== סיכום ===`);
      console.log(`סה"כ משחקים: ${fixtures.length}`);

      return fixtures;
    } catch (error) {
      console.error("המשיכה נכשלה:", error.message);
      throw error;
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const fetcher = new ChampionsLeagueFetcher();

  (async () => {
    try {
      await fetcher.fetchAndDisplayAllFixtures();
      console.log("\nהמשיכה הושלמה בהצלחה!");
    } catch (error) {
      console.error("המשיכה נכשלה:", error.message);
      process.exit(1);
    }
  })();
}

export default ChampionsLeagueFetcher;
