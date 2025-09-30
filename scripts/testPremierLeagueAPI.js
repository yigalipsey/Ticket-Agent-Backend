import axios from "axios";
import { logWithCheckpoint, logError } from "../src/utils/logger.js";

const API_KEY = "dbce3565f0f15507e9814804eed43fe2";
const BASE_URL = "https://v3.football.api-sports.io";

async function testPremierLeagueAPI() {
  try {
    logWithCheckpoint("info", "Starting Premier League API test", "API_001");

    const response = await axios.get(`${BASE_URL}/fixtures`, {
      params: {
        league: 39, // Premier League
        season: 2024, // 2024/25 season
        from: "2024-08-01", // Start of season
        to: "2025-05-31", // End of season
      },
      headers: {
        "x-apisports-key": API_KEY,
        accept: "application/json",
      },
      timeout: 30000,
    });

    const fixtures = response.data.response;

    logWithCheckpoint("info", "API call successful", "API_002", {
      totalFixtures: fixtures.length,
    });

    console.log("\n🏆 Premier League API Test Results:");
    console.log("===================================");
    console.log(`📊 Total fixtures received: ${fixtures.length}`);

    if (fixtures.length > 0) {
      // Show first few fixtures
      console.log("\n⚽ First 5 fixtures:");
      fixtures.slice(0, 5).forEach((fixture, index) => {
        const date = new Date(fixture.fixture.date).toLocaleDateString("he-IL");
        const time = new Date(fixture.fixture.date).toLocaleTimeString("he-IL");
        console.log(
          `${index + 1}. ${fixture.teams.home.name} vs ${
            fixture.teams.away.name
          } - ${date} ${time} (${fixture.venue.name})`
        );
      });

      // Show last few fixtures
      console.log("\n⚽ Last 5 fixtures:");
      fixtures.slice(-5).forEach((fixture, index) => {
        const date = new Date(fixture.fixture.date).toLocaleDateString("he-IL");
        const time = new Date(fixture.fixture.date).toLocaleTimeString("he-IL");
        console.log(
          `${index + 1}. ${fixture.teams.home.name} vs ${
            fixture.teams.away.name
          } - ${date} ${time} (${fixture.venue.name})`
        );
      });

      // Get unique teams
      const homeTeams = [...new Set(fixtures.map((f) => f.teams.home.name))];
      const awayTeams = [...new Set(fixtures.map((f) => f.teams.away.name))];
      const allTeams = [...new Set([...homeTeams, ...awayTeams])];

      // Get unique venues
      const venues = [...new Set(fixtures.map((f) => f.venue.name))];

      console.log(`\n👥 Teams (${allTeams.length}):`);
      allTeams.forEach((team, index) => {
        console.log(`${index + 1}. ${team}`);
      });

      console.log(`\n🏟️ Venues (${venues.length}):`);
      venues.forEach((venue, index) => {
        console.log(`${index + 1}. ${venue}`);
      });

      // Show fixture status distribution
      const statusCounts = {};
      fixtures.forEach((fixture) => {
        const status = fixture.fixture.status.short;
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      console.log("\n📊 Fixture Status Distribution:");
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`${status}: ${count} fixtures`);
      });

      // Show date range
      const dates = fixtures.map((f) => new Date(f.fixture.date));
      const earliestDate = new Date(Math.min(...dates));
      const latestDate = new Date(Math.max(...dates));

      console.log("\n📅 Season Date Range:");
      console.log(
        `From: ${earliestDate.toLocaleDateString(
          "he-IL"
        )} to ${latestDate.toLocaleDateString("he-IL")}`
      );
    }

    logWithCheckpoint("info", "API test completed successfully", "API_003", {
      totalFixtures: fixtures.length,
      teams: fixtures.length > 0 ? allTeams?.length || 0 : 0,
      venues: fixtures.length > 0 ? venues?.length || 0 : 0,
    });

    return fixtures;
  } catch (error) {
    logError(error, { operation: "testPremierLeagueAPI" });
    console.error("❌ API test failed:", error.message);

    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }

    throw error;
  }
}

// Run the test
testPremierLeagueAPI()
  .then((fixtures) => {
    console.log(
      `\n✅ Test completed successfully! Received ${fixtures.length} fixtures.`
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  });
