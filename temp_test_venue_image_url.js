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

// Test venue image URLs
async function testVenueImages() {
  try {
    console.log("🔍 Testing venue image URLs from API...\n");

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

    console.log(`✅ Found ${uniqueVenues.length} venues\n`);
    console.log("=".repeat(80));
    console.log("🔍 Testing image URLs...\n");

    // Test first 5 venues
    for (let i = 0; i < Math.min(5, uniqueVenues.length); i++) {
      const item = uniqueVenues[i];
      const imageUrl = item.venue.image;

      console.log(`${i + 1}. ${item.venue.name}`);
      console.log(`   Team: ${item.team}`);
      console.log(`   Image URL from API: ${imageUrl}`);

      // Test if image URL is accessible
      try {
        const imageResponse = await axios.head(imageUrl, {
          timeout: 5000,
          validateStatus: (status) => status < 400,
        });

        if (imageResponse.status === 200) {
          console.log(`   ✅ Image URL is VALID and accessible`);
          console.log(
            `   Content-Type: ${imageResponse.headers["content-type"]}`
          );
        } else {
          console.log(
            `   ⚠️  Image URL returned status: ${imageResponse.status}`
          );
        }
      } catch (error) {
        console.log(`   ❌ Image URL is NOT accessible: ${error.message}`);

        // Try alternative formats
        const venueId = item.venue.id;
        const alternatives = [
          `https://media.api-sports.io/football/venues/${venueId}.jpg`,
          `https://media.api-sports.io/football/venues/${venueId}.png`,
          `https://media.api-sports.io/football/venues/${venueId}`,
          `https://media.api-sports.io/football/stadiums/${venueId}.png`,
        ];

        console.log(`   🔄 Trying alternatives...`);
        for (const altUrl of alternatives) {
          try {
            const altResponse = await axios.head(altUrl, {
              timeout: 5000,
              validateStatus: (status) => status < 400,
            });
            if (altResponse.status === 200) {
              console.log(`   ✅ FOUND WORKING URL: ${altUrl}`);
              break;
            }
          } catch (e) {
            // Silent fail
          }
        }
      }

      console.log("");
    }

    console.log("=".repeat(80));
    console.log("\n📋 WORKING IMAGE URLs:\n");

    // Show only working URLs
    for (const item of uniqueVenues.slice(0, 10)) {
      const imageUrl = item.venue.image;
      try {
        await axios.head(imageUrl, {
          timeout: 3000,
          validateStatus: (status) => status < 400,
        });
        console.log(`${imageUrl}`);
      } catch (error) {
        // Skip invalid URLs
      }
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.response) {
      console.error("API Response:", error.response.data);
    }
    throw error;
  }
}

// Run the script
testVenueImages();
