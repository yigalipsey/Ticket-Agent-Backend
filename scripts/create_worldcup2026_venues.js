import dotenv from "dotenv";
import axios from "axios";
import Venue from "../src/models/Venue.js";
import League from "../src/models/League.js";
import databaseConnection from "../src/config/database.js";

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

// World Cup 2026 configuration
const WORLD_CUP_API_FOOTBALL_ID = 1; // API-Football league ID for World Cup
const CURRENT_SEASON = 2026;

// Country translations
const countryTranslations = {
  England: "אנגליה",
  Spain: "ספרד",
  Germany: "גרמניה",
  Italy: "איטליה",
  France: "צרפת",
  "United States": "ארצות הברית",
  "USA": "ארצות הברית",
  Canada: "קנדה",
  Mexico: "מקסיקו",
  Greece: "יוון",
  Scotland: "סקוטלנד",
  "Czech Republic": "צ'כיה",
  Portugal: "פורטוגל",
  Cyprus: "קפריסין",
  Austria: "אוסטריה",
  Poland: "פולין",
  Norway: "נורווגיה",
  Sweden: "שוודיה",
  Netherlands: "הולנד",
  Belgium: "בלגיה",
  Switzerland: "שוויץ",
  Moldova: "מולדובה",
  Azerbaijan: "אזרבייג'ן",
  Israel: "ישראל",
  Europe: "אירופה",
  Ukraine: "אוקראינה",
  Russia: "רוסיה",
  Turkey: "טורקיה",
  Croatia: "קרואטיה",
  Serbia: "סרביה",
  Romania: "רומניה",
  Hungary: "הונגריה",
  Slovakia: "סלובקיה",
  Slovenia: "סלובניה",
  Denmark: "דנמרק",
  Finland: "פינלנד",
  Ireland: "אירלנד",
  Wales: "ויילס",
  "Northern Ireland": "צפון אירלנד",
  "Bosnia-Herzegovina": "בוסניה והרצגובינה",
  Bosnia: "בוסניה",
  Herzegovina: "הרצגובינה",
  "North Macedonia": "צפון מקדוניה",
  Macedonia: "מקדוניה",
  Kosovo: "קוסובו",
  Malta: "מלטה",
  Kazakhstan: "קזחסטן",
  Belarus: "בלארוס",
  Iceland: "איסלנד",
  Lichtenstein: "לטנשטיין",
  Armenia: "ארמניה",
  Georgia: "גאורגיה",
  Albania: "אלבניה",
  Montenegro: "מונטנגרו",
  Latvia: "לטביה",
  Lithuania: "ליטא",
  Estonia: "אסטוניה",
  Argentina: "ארגנטינה",
  Brazil: "ברזיל",
  "South Korea": "דרום קוריאה",
  Japan: "יפן",
  Australia: "אוסטרליה",
  "Saudi Arabia": "ערב הסעודית",
  Qatar: "קטר",
  Morocco: "מרוקו",
  Tunisia: "תוניסיה",
  Egypt: "מצרים",
  Senegal: "סנגל",
  Ghana: "גאנה",
  Nigeria: "ניגריה",
  Cameroon: "קמרון",
  "Ivory Coast": "חוף השנהב",
  "Costa Rica": "קוסטה ריקה",
  "Costa-Rica": "קוסטה ריקה",
  Ecuador: "אקוודור",
  Uruguay: "אורוגוואי",
  Paraguay: "פרגוואי",
  Chile: "צ'ילה",
  Colombia: "קולומביה",
  Peru: "פרו",
  Venezuela: "ונצואלה",
  Panama: "פנמה",
  Jamaica: "ג'מייקה",
  Honduras: "הונדורס",
  "El Salvador": "אל סלבדור",
  "Trinidad and Tobago": "טרינידד וטובגו",
  "New Zealand": "ניו זילנד",
  China: "סין",
  Iran: "איראן",
  "United Arab Emirates": "איחוד האמירויות",
  Oman: "עומאן",
  Iraq: "עיראק",
  Uzbekistan: "אוזבקיסטן",
};

// Translate country to Hebrew
function translateCountry(country) {
  return countryTranslations[country] || country;
}

// City translations for World Cup 2026 cities
const cityTranslations = {
  "Mexico City": "מקסיקו סיטי",
  "Mexico": "מקסיקו סיטי",
  "Monterrey": "מונטריי",
  "Guadalajara": "גוודלחרה",
  "New York": "ניו יורק",
  "New Jersey": "ניו ג'רזי",
  "Los Angeles": "לוס אנג'לס",
  "Miami": "מיאמי",
  "Dallas": "דאלאס",
  "Houston": "יוסטון",
  "Atlanta": "אטלנטה",
  "Boston": "בוסטון",
  "Philadelphia": "פילדלפיה",
  "San Francisco": "סן פרנסיסקו",
  "Seattle": "סיאטל",
  "Kansas City": "קנזס סיטי",
  "Toronto": "טורונטו",
  "Vancouver": "ונקובר",
};

// Translate city to Hebrew
function translateCity(city) {
  if (!city || city === "Unknown") return undefined;

  const cleanCity = city.trim();

  if (cityTranslations[cleanCity]) {
    return cityTranslations[cleanCity];
  }

  const cityPart = cleanCity.split(/[,/]/)[0].trim();
  if (cityTranslations[cityPart]) {
    return cityTranslations[cityPart];
  }

  for (const [key, value] of Object.entries(cityTranslations)) {
    if (
      key.toLowerCase() === cleanCity.toLowerCase() ||
      key.toLowerCase() === cityPart.toLowerCase()
    ) {
      return value;
    }
  }

  return undefined;
}

// Step 1: Find existing venues for World Cup 2026
async function findExistingVenues() {
  try {
    console.log("=".repeat(80));
    console.log("📍 STEP 1: Finding existing venues for World Cup 2026");
    console.log("=".repeat(80));
    console.log("");

    // Find the league
    const league = await League.findOne({
      $or: [
        { slug: "world-cup-2026" },
        { "externalIds.apiFootball": WORLD_CUP_API_FOOTBALL_ID },
      ],
    });

    if (!league) {
      console.log("❌ World Cup 2026 not found in database");
      console.log("   Please run create_worldcup2026_league.js first");
      return [];
    }

    console.log(`✅ Found league: ${league.name} (${league.nameHe || "N/A"})`);
    console.log("");

    // Find all venues (we'll check which ones are used by World Cup matches later)
    const allVenues = await Venue.find({}).lean();

    console.log(`📊 Found ${allVenues.length} total venues in database`);
    console.log("");

    return allVenues;
  } catch (error) {
    console.error("❌ Error finding existing venues:", error.message);
    throw error;
  }
}

// Known World Cup 2026 venues (manual data since API might not have it yet)
const KNOWN_WORLD_CUP_VENUES = [
  // Mexico
  { name: "Estadio Azteca", city: "Mexico City", country: "Mexico", capacity: 87523, venueId: 1001 },
  { name: "Estadio BBVA", city: "Monterrey", country: "Mexico", capacity: 53460, venueId: 1002 },
  { name: "Estadio Akron", city: "Guadalajara", country: "Mexico", capacity: 49250, venueId: 1003 },
  // USA
  { name: "MetLife Stadium", city: "East Rutherford", country: "United States", capacity: 82500, venueId: 1004 },
  { name: "Mercedes-Benz Stadium", city: "Atlanta", country: "United States", capacity: 71000, venueId: 1005 },
  { name: "AT&T Stadium", city: "Arlington", country: "United States", capacity: 80000, venueId: 1006 },
  { name: "NRG Stadium", city: "Houston", country: "United States", capacity: 72220, venueId: 1007 },
  { name: "SoFi Stadium", city: "Inglewood", country: "United States", capacity: 70240, venueId: 1008 },
  { name: "Gillette Stadium", city: "Foxborough", country: "United States", capacity: 65878, venueId: 1009 },
  { name: "Lincoln Financial Field", city: "Philadelphia", country: "United States", capacity: 69796, venueId: 1010 },
  { name: "Levi's Stadium", city: "Santa Clara", country: "United States", capacity: 68500, venueId: 1011 },
  { name: "Lumen Field", city: "Seattle", country: "United States", capacity: 69000, venueId: 1012 },
  { name: "Arrowhead Stadium", city: "Kansas City", country: "United States", capacity: 76416, venueId: 1013 },
  // Canada
  { name: "BMO Field", city: "Toronto", country: "Canada", capacity: 30000, venueId: 1014 },
  { name: "BC Place", city: "Vancouver", country: "Canada", capacity: 54500, venueId: 1015 },
];

// Step 2: Get venues (from API or manual data)
async function fetchVenuesFromAPI() {
  try {
    console.log("=".repeat(80));
    console.log("📍 STEP 2: Fetching venues from API-Football");
    console.log("=".repeat(80));
    console.log("");

    console.log(
      `🔍 Fetching fixtures for World Cup 2026 (ID: ${WORLD_CUP_API_FOOTBALL_ID}, Season: ${CURRENT_SEASON})...`
    );
    console.log("");

    let venues = [];

    // Try to fetch from API first
    try {
      const fixturesResponse = await apiClient.get("/fixtures", {
        params: {
          league: WORLD_CUP_API_FOOTBALL_ID,
          season: CURRENT_SEASON,
        },
      });

      if (
        fixturesResponse.data &&
        fixturesResponse.data.response &&
        fixturesResponse.data.response.length > 0
      ) {
        console.log(
          `✅ Found ${fixturesResponse.data.response.length} fixtures in API response`
        );
        console.log("");

        // Extract venues from fixtures
        const apiVenues = fixturesResponse.data.response
          .map((item) => ({
            venue: item.venue,
            homeTeam: item.teams?.home?.name,
            awayTeam: item.teams?.away?.name,
          }))
          .filter((item) => item.venue !== null && item.venue !== undefined);

        // Remove duplicates by venue ID
        const seenIds = new Set();
        for (const item of apiVenues) {
          if (item.venue.id && !seenIds.has(item.venue.id)) {
            seenIds.add(item.venue.id);
            venues.push(item);
          }
        }
      }
    } catch (apiError) {
      console.log("⚠️  Could not fetch from API, using known venues data");
      console.log("");
    }

    // If no venues from API, use known venues
    if (venues.length === 0) {
      console.log("📋 Using known World Cup 2026 venues data");
      console.log("");
      venues = KNOWN_WORLD_CUP_VENUES.map((venue) => ({
        venue: {
          id: venue.venueId,
          name: venue.name,
          city: venue.city,
          country: venue.country,
          capacity: venue.capacity,
          image: null,
        },
        homeTeam: null,
        awayTeam: null,
      }));
    }

    console.log(`🏟️  Found ${venues.length} unique venues`);
    console.log("");

    // Display venues
    venues.forEach((item, index) => {
      console.log(`${index + 1}. ${item.venue.name}`);
      console.log(`   City: ${item.venue.city || "N/A"}`);
      console.log(`   Country: ${item.venue.country || "N/A"}`);
      console.log(`   Capacity: ${item.venue.capacity || "N/A"}`);
      console.log(`   Venue ID: ${item.venue.id}`);
      console.log(`   Image: ${item.venue.image ? "✅ Yes" : "❌ No"}`);
      console.log("");
    });

    console.log("=".repeat(80));
    console.log("");

    return venues;
  } catch (error) {
    console.error("❌ Error fetching venues from API:", error.message);
    if (error.response) {
      console.error("API Response:", error.response.data);
    }
    throw error;
  }
}

// Step 3: Insert new venues
async function insertNewVenues(apiVenues, existingVenues) {
  try {
    console.log("=".repeat(80));
    console.log("📍 STEP 3: Inserting new venues");
    console.log("=".repeat(80));
    console.log("");

    // Create set of existing API-Football IDs
    const existingApiIds = new Set();
    existingVenues.forEach((venue) => {
      if (venue.externalIds?.apiFootball) {
        existingApiIds.add(venue.externalIds.apiFootball);
      }
      if (venue.venueId) {
        existingApiIds.add(venue.venueId);
      }
    });

    console.log(
      `📊 Existing venues in database: ${existingApiIds.size} with API-Football IDs`
    );
    console.log("");

    const newVenues = [];
    const skippedVenues = [];
    const updatedVenues = [];

    for (const item of apiVenues) {
      const venueData = item.venue;
      const apiFootballId = venueData.id;

      // Prepare Hebrew translations
      const countryEn = venueData.country || "Unknown";
      const countryHe = translateCountry(countryEn);
      const cityEn = venueData.city || "Unknown";
      const cityHe = translateCity(cityEn);
      const nameEn = venueData.name || "Unknown Venue";

      // Check if venue already exists by API-Football ID
      const existingByApiId = await Venue.findOne({
        "externalIds.apiFootball": apiFootballId,
      });

      // Check if venue exists by venueId
      const existingByVenueId = await Venue.findOne({
        venueId: apiFootballId,
      });

      const existingVenue = existingByApiId || existingByVenueId;

      if (existingVenue) {
        // Check if venue needs Hebrew translation updates
        const nameNeedsUpdate = false; // name_en now contains Hebrew, no separate name_he field
        const cityNeedsUpdate =
          !existingVenue.city_he ||
          existingVenue.city_he === existingVenue.city_en;
        const countryNeedsUpdate =
          !existingVenue.country_he || existingVenue.country_en === "Unknown";

        const needsUpdate =
          nameNeedsUpdate || cityNeedsUpdate || countryNeedsUpdate;

        if (needsUpdate) {
          const updateData = {};
          if (
            (!existingVenue.city_he ||
              existingVenue.city_he === existingVenue.city_en) &&
            cityHe
          ) {
            updateData.city_he = cityHe;
          }
          if (
            !existingVenue.country_he ||
            existingVenue.country_en === "Unknown"
          ) {
            if (countryEn !== "Unknown") {
              updateData.country_en = countryEn;
            }
            updateData.country_he = countryHe;
          }

          if (Object.keys(updateData).length > 0) {
            await Venue.findByIdAndUpdate(existingVenue._id, updateData, {
              new: true,
            });
            updatedVenues.push({
              name: venueData.name,
              id: apiFootballId,
              updatedFields: Object.keys(updateData),
            });
            continue;
          }
        }

        skippedVenues.push({
          name: venueData.name,
          id: apiFootballId,
          reason: "Already exists (no updates needed)",
        });
        continue;
      }

      const newVenueData = {
        name_en: nameEn, // name_en now contains Hebrew (or English if no translation)
        city_en: cityEn,
        city_he: cityHe || undefined,
        country_en: countryEn !== "Unknown" ? countryEn : undefined,
        country_he: countryEn !== "Unknown" ? countryHe : undefined,
        capacity: venueData.capacity || null,
        address_en: venueData.address || undefined,
        image: venueData.image || undefined,
        venueId: apiFootballId,
        externalIds: {
          apiFootball: apiFootballId,
        },
      };

      newVenues.push({
        data: newVenueData,
      });
    }

    console.log(`📊 Analysis:`);
    console.log(`   Total venues from API: ${apiVenues.length}`);
    console.log(`   Already exist (no updates): ${skippedVenues.length}`);
    console.log(`   Updated with Hebrew: ${updatedVenues.length}`);
    console.log(`   New venues to insert: ${newVenues.length}`);
    console.log("");

    if (updatedVenues.length > 0) {
      console.log("🔄 Updated venues with Hebrew translations:");
      updatedVenues.forEach((venue, index) => {
        console.log(
          `   ${index + 1}. ${venue.name} (ID: ${
            venue.id
          }) - Updated: ${venue.updatedFields.join(", ")}`
        );
      });
      console.log("");
    }

    if (skippedVenues.length > 0) {
      console.log("⏭️  Skipped venues (already exist):");
      skippedVenues.forEach((venue, index) => {
        console.log(
          `   ${index + 1}. ${venue.name} (ID: ${venue.id}) - ${venue.reason}`
        );
      });
      console.log("");
    }

    if (newVenues.length === 0) {
      console.log("✅ No new venues to insert. All venues already exist!");
      console.log("");
      return { inserted: 0, skipped: skippedVenues.length };
    }

    console.log("🆕 New venues to insert:");
    newVenues.forEach((item, index) => {
      console.log(
        `   ${index + 1}. ${item.data.name_en} (City: ${
          item.data.city_en
        }, Country: ${item.data.country_en})`
      );
    });
    console.log("");

    // Insert venues
    console.log("💾 Inserting venues into database...");
    console.log("");

    let insertedCount = 0;
    let errorCount = 0;

    for (const item of newVenues) {
      try {
        const venue = new Venue(item.data);
        await venue.save();
        insertedCount++;
        console.log(
          `✅ [${insertedCount}/${newVenues.length}] Inserted: ${item.data.name_en} (ID: ${item.data.venueId})`
        );
      } catch (error) {
        errorCount++;
        console.error(
          `❌ Failed to insert ${item.data.name_en}: ${error.message}`
        );
      }
    }

    console.log("");
    console.log("=".repeat(80));
    console.log("📝 Summary:");
    console.log("=".repeat(80));
    console.log(`   Total venues from API: ${apiVenues.length}`);
    console.log(`   Already exist (no updates): ${skippedVenues.length}`);
    console.log(`   Updated with Hebrew: ${updatedVenues.length}`);
    console.log(`   Successfully inserted: ${insertedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log("=".repeat(80));
    console.log("");

    return {
      inserted: insertedCount,
      updated: updatedVenues.length,
      skipped: skippedVenues.length,
      errors: errorCount,
    };
  } catch (error) {
    console.error("❌ Error inserting venues:", error.message);
    throw error;
  }
}

// Main function
async function main() {
  try {
    // Connect to database
    console.log("🔌 Connecting to database...");
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("❌ MONGODB_URI not found in environment variables");
      process.exit(1);
    }

    const connected = await databaseConnection.connect(mongoUri);
    if (!connected) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }
    console.log("✅ Connected to database");
    console.log("");

    // Step 1: Find existing venues
    const existingVenues = await findExistingVenues();

    // Step 2: Fetch venues from API
    const apiVenues = await fetchVenuesFromAPI();

    if (apiVenues.length === 0) {
      console.log("❌ No venues found in API response");
      await databaseConnection.disconnect();
      process.exit(0);
    }

    // Step 3: Insert new venues
    const result = await insertNewVenues(apiVenues, existingVenues);

    // Disconnect from database
    await databaseConnection.disconnect();
    console.log("✅ Disconnected from database");
    console.log("");

    console.log("🎉 Script completed successfully!");
    console.log("");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    if (databaseConnection.isDatabaseConnected()) {
      await databaseConnection.disconnect();
    }
    process.exit(1);
  }
}

// Run the script
main();

