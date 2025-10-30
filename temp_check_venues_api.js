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

// Fetch venues from API
async function fetchVenuesFromAPI() {
  try {
    console.log("🔍 Fetching venues from API Football...\n");

    // Try different endpoints - API Football might have venues endpoint
    // Let's check what endpoints are available
    const endpoints = [
      { name: "venues", path: "/venues" },
      { name: "venues with season", path: "/venues", params: { season: 2024 } },
    ];

    let venues = [];
    let hasImages = false;
    let sampleVenue = null;

    // Try to get venues
    try {
      console.log("Trying /venues endpoint...");
      const response = await apiClient.get("/venues", {
        params: {
          league: 3, // UEFA Europa League ID
          season: 2024,
        },
      });

      if (response.data && response.data.response) {
        venues = response.data.response;
        console.log(`✅ Found ${venues.length} venues from /venues endpoint\n`);
      }
    } catch (error) {
      console.log("❌ /venues endpoint not available or returned error");
      console.log(`Error: ${error.response?.data?.message || error.message}\n`);
    }

    // If venues endpoint doesn't work, try to get venues from teams
    if (venues.length === 0) {
      console.log("Trying to get venues from teams endpoint...");
      try {
        const teamsResponse = await apiClient.get("/teams", {
          params: {
            league: 3, // UEFA Europa League
            season: 2024,
          },
        });

        if (
          teamsResponse.data &&
          teamsResponse.data.response &&
          teamsResponse.data.response.length > 0
        ) {
          console.log(
            `✅ Found ${teamsResponse.data.response.length} teams with venue data\n`
          );

          venues = teamsResponse.data.response
            .map((item) => item.venue)
            .filter((venue) => venue !== null && venue !== undefined);

          // Remove duplicates by venue ID
          const uniqueVenues = [];
          const seenIds = new Set();
          for (const venue of venues) {
            if (venue.id && !seenIds.has(venue.id)) {
              seenIds.add(venue.id);
              uniqueVenues.push(venue);
            }
          }
          venues = uniqueVenues;

          console.log(`✅ Found ${venues.length} unique venues from teams\n`);
        }
      } catch (error) {
        console.log("❌ Failed to get venues from teams");
        console.log(
          `Error: ${error.response?.data?.message || error.message}\n`
        );
      }
    }

    // Check if venues have images
    if (venues.length > 0) {
      sampleVenue = venues[0];
      console.log("📋 Sample venue structure:");
      console.log(JSON.stringify(sampleVenue, null, 2));
      console.log("\n");

      // Check for image fields
      const imageFields = [
        "image",
        "images",
        "photo",
        "photos",
        "picture",
        "pictures",
        "logo",
        "logoUrl",
        "imageUrl",
      ];

      hasImages = imageFields.some((field) => {
        const hasField =
          sampleVenue[field] !== undefined && sampleVenue[field] !== null;
        if (hasField) {
          console.log(`✅ Found image field: ${field}`);
          console.log(`   Value: ${JSON.stringify(sampleVenue[field])}`);
        }
        return hasField;
      });

      if (!hasImages) {
        console.log("❌ No image fields found in venue data structure\n");
      }

      // Check all venues for images
      let venuesWithImages = 0;
      for (const venue of venues) {
        if (
          venue.image ||
          venue.images ||
          venue.photo ||
          venue.logo ||
          venue.imageUrl
        ) {
          venuesWithImages++;
        }
      }

      console.log(`\n📊 Statistics:`);
      console.log(`   Total venues: ${venues.length}`);
      console.log(`   Venues with images: ${venuesWithImages}`);
      console.log(
        `   Venues without images: ${venues.length - venuesWithImages}`
      );
    } else {
      console.log("❌ No venues found in API response");
    }

    return {
      venues,
      hasImages,
      sampleVenue,
      totalVenues: venues.length,
    };
  } catch (error) {
    console.error("❌ Error fetching venues:", error.message);
    if (error.response) {
      console.error("API Response:", error.response.data);
    }
    throw error;
  }
}

// Main function
async function main() {
  try {
    const result = await fetchVenuesFromAPI();

    console.log("\n" + "=".repeat(50));
    console.log("📝 Summary:");
    console.log("=".repeat(50));
    console.log(`Total venues found: ${result.totalVenues}`);
    console.log(`Has images field: ${result.hasImages ? "✅ YES" : "❌ NO"}`);

    if (result.sampleVenue) {
      console.log("\n📋 Available fields in venue object:");
      console.log(Object.keys(result.sampleVenue).join(", "));
    }

    console.log("\n" + "=".repeat(50));
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

// Run the script
main();
