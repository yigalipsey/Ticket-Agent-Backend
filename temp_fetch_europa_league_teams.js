import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

// API Football configuration
const API_FOOTBALL_BASE_URL =
  process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;

if (!API_FOOTBALL_KEY) {
  console.error("❌ API_FOOTBALL_KEY not found in environment variables");
  process.exit(1);
}

// API Football client
const apiClient = axios.create({
  baseURL: API_FOOTBALL_BASE_URL,
  headers: {
    "x-rapidapi-key": API_FOOTBALL_KEY,
    "x-rapidapi-host": "v3.football.api-sports.io",
  },
  timeout: 30000,
});

// UEFA Europa League configuration
const API_FOOTBALL_LEAGUE_ID = 3; // API-Football league ID
const CURRENT_SEASON = 2025;

async function fetchTeams() {
  try {
    console.log("=".repeat(80));
    console.log(
      `📋 Fetching Active UEFA Europa League Teams (Season ${CURRENT_SEASON})`
    );
    console.log("=".repeat(80));
    console.log("");

    console.log(
      `🔍 Fetching teams for UEFA Europa League (ID: ${API_FOOTBALL_LEAGUE_ID}, Season: ${CURRENT_SEASON})...`
    );
    console.log("");

    const teamsResponse = await apiClient.get("/teams", {
      params: {
        league: API_FOOTBALL_LEAGUE_ID,
        season: CURRENT_SEASON,
      },
    });

    if (
      !teamsResponse.data ||
      !teamsResponse.data.response ||
      teamsResponse.data.response.length === 0
    ) {
      console.log("❌ No teams found in API response");
      return [];
    }

    const teams = teamsResponse.data.response.map((item) => ({
      team: item.team,
      venue: item.venue,
    }));

    console.log(`✅ Found ${teams.length} teams in UEFA Europa League`);
    console.log("");
    console.log("=".repeat(80));
    console.log("");

    // Display teams
    teams.forEach((item, index) => {
      const team = item.team;
      const venue = item.venue;

      console.log(`${index + 1}. ${team.name}`);
      console.log(`   ID: ${team.id}`);
      console.log(`   Code: ${team.code || "N/A"}`);
      console.log(`   Country: ${team.country || "N/A"}`);
      console.log(`   Founded: ${team.founded || "N/A"}`);
      console.log(`   National: ${team.national ? "Yes" : "No"}`);
      if (team.logo) {
        console.log(`   Logo: ${team.logo}`);
      }
      if (venue) {
        console.log(`   Venue: ${venue.name}`);
        console.log(`   Venue City: ${venue.city || "N/A"}`);
        console.log(`   Venue Capacity: ${venue.capacity || "N/A"}`);
        console.log(`   Venue ID: ${venue.id}`);
      }
      console.log("");
    });

    console.log("=".repeat(80));
    console.log("📊 Summary:");
    console.log("=".repeat(80));
    console.log(`   Total teams: ${teams.length}`);

    // Group by country
    const teamsByCountry = {};
    teams.forEach((item) => {
      const country = item.team.country || "Unknown";
      if (!teamsByCountry[country]) {
        teamsByCountry[country] = [];
      }
      teamsByCountry[country].push(item.team.name);
    });

    console.log("");
    console.log("📌 Teams by Country:");
    Object.keys(teamsByCountry)
      .sort()
      .forEach((country) => {
        console.log(`   ${country}: ${teamsByCountry[country].length} teams`);
        teamsByCountry[country].forEach((teamName) => {
          console.log(`      - ${teamName}`);
        });
      });

    console.log("");
    console.log("=".repeat(80));

    return teams;
  } catch (error) {
    console.error("❌ Error fetching teams:", error.message);
    if (error.response) {
      console.error("API Response:", error.response.data);
    }
    throw error;
  }
}

// Main function
async function main() {
  try {
    await fetchTeams();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

// Run the script
main();
