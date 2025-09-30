import axios from "axios";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

const API_KEY = "dbce3565f0f15507e9814804eed43fe2";
const BASE_URL = "https://v3.football.api-sports.io";

async function checkAvailableLeagues() {
  try {
    logWithCheckpoint("info", "Checking available leagues", "LEAGUE_001");

    // Get all leagues
    const leaguesResponse = await axios.get(`${BASE_URL}/leagues`, {
      headers: {
        "x-apisports-key": API_KEY,
        accept: "application/json",
      },
      timeout: 30000,
    });

    const leagues = leaguesResponse.data.response;

    logWithCheckpoint("info", "Leagues API call successful", "LEAGUE_002", {
      totalLeagues: leagues.length,
    });

    console.log("\n🏆 Available Leagues:");
    console.log("====================");

    // Find Premier League
    const premierLeague = leagues.find(
      (league) =>
        league.league.id === 39 || league.league.name.includes("Premier")
    );

    if (premierLeague) {
      console.log("\n⚽ Premier League Found:");
      console.log(`ID: ${premierLeague.league.id}`);
      console.log(`Name: ${premierLeague.league.name}`);
      console.log(`Country: ${premierLeague.country.name}`);
      console.log(`Logo: ${premierLeague.league.logo}`);
      console.log(`Seasons: ${premierLeague.seasons.length}`);

      console.log("\n📅 Available Seasons:");
      premierLeague.seasons.forEach((season) => {
        console.log(`- ${season.year} (${season.start} to ${season.end})`);
      });

      // Test fixtures for the latest season
      const latestSeason =
        premierLeague.seasons[premierLeague.seasons.length - 1];
      console.log(`\n🔍 Testing fixtures for season ${latestSeason.year}...`);

      const fixturesResponse = await axios.get(`${BASE_URL}/fixtures`, {
        params: {
          league: premierLeague.league.id,
          season: latestSeason.year,
        },
        headers: {
          "x-apisports-key": API_KEY,
          accept: "application/json",
        },
        timeout: 30000,
      });

      const fixtures = fixturesResponse.data.response;
      console.log(
        `📊 Found ${fixtures.length} fixtures for season ${latestSeason.year}`
      );

      if (fixtures.length > 0) {
        console.log("\n⚽ Sample fixtures:");
        fixtures.slice(0, 3).forEach((fixture, index) => {
          const date = new Date(fixture.fixture.date).toLocaleDateString(
            "he-IL"
          );
          console.log(
            `${index + 1}. ${fixture.teams.home.name} vs ${
              fixture.teams.away.name
            } - ${date}`
          );
        });
      }
    } else {
      console.log("❌ Premier League not found in available leagues");
    }

    // Show all available leagues (first 20)
    console.log("\n📋 All Available Leagues (first 20):");
    leagues.slice(0, 20).forEach((league, index) => {
      console.log(
        `${index + 1}. ${league.league.name} (${league.country.name}) - ID: ${
          league.league.id
        }`
      );
    });

    logWithCheckpoint("info", "League check completed", "LEAGUE_003", {
      totalLeagues: leagues.length,
      premierLeagueFound: !!premierLeague,
    });

    return leagues;
  } catch (error) {
    logError(error, { operation: "checkAvailableLeagues" });
    console.error("❌ League check failed:", error.message);

    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }

    throw error;
  }
}

// Run the check
checkAvailableLeagues()
  .then((leagues) => {
    console.log(`\n✅ Check completed! Found ${leagues.length} leagues.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Check failed:", error.message);
    process.exit(1);
  });
