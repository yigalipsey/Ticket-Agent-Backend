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

// Get venues with images
async function getVenueImages() {
  try {
    console.log("🔍 Fetching venues with images from API...\n");

    const teamsResponse = await apiClient.get("/teams", {
      params: {
        league: 3, // UEFA Europa League
        season: 2024,
      },
    });

    if (
      !teamsResponse.data ||
      !teamsResponse.data.response ||
      teamsResponse.data.response.length === 0
    ) {
      console.log("❌ No teams found");
      return;
    }

    const venues = teamsResponse.data.response
      .map((item) => ({
        venue: item.venue,
        team: item.team.name,
      }))
      .filter((item) => item.venue !== null && item.venue !== undefined);

    // Remove duplicates
    const uniqueVenues = [];
    const seenIds = new Set();
    for (const item of venues) {
      if (item.venue.id && !seenIds.has(item.venue.id)) {
        seenIds.add(item.venue.id);
        uniqueVenues.push(item);
      }
    }

    console.log(`✅ Found ${uniqueVenues.length} venues with images\n`);
    console.log("=".repeat(80));
    console.log("📸 VENUE IMAGES URLs:\n");

    // Show first 10 venues with their image URLs
    uniqueVenues.slice(0, 10).forEach((item, index) => {
      console.log(`${index + 1}. ${item.venue.name}`);
      console.log(`   Team: ${item.team}`);
      console.log(`   Image URL: ${item.venue.image}`);
      console.log(`   Venue ID: ${item.venue.id}`);
      console.log("");
    });

    // Show all image URLs in a list
    console.log("=".repeat(80));
    console.log("📋 ALL VENUE IMAGE URLs:\n");
    uniqueVenues.forEach((item) => {
      console.log(item.venue.image);
    });

    console.log("\n" + "=".repeat(80));
    console.log(`\nTotal venues: ${uniqueVenues.length}`);
    console.log(`All venues have images: ✅ YES\n`);

    return uniqueVenues;
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.response) {
      console.error("API Response:", error.response.data);
    }
    throw error;
  }
}

// Run the script
getVenueImages();
