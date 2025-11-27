import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import databaseConnection from "../src/config/database.js";
import Venue from "../src/models/Venue.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const STADIUMS_FILE = path.resolve(
  __dirname,
  "../data/footballapi/bundesliga_stadiums.json"
);
const OUTPUT_DIR = path.resolve(__dirname, "../data/footballapi");
const REPORT_FILE = path.resolve(
  OUTPUT_DIR,
  `bundesliga_stadiums_verification_report.json`
);

async function verifyBundesligaStadiums() {
  try {
    console.log("=".repeat(80));
    console.log("🔍 Verifying Bundesliga Stadiums in Database");
    console.log("=".repeat(80));
    console.log("");

    // Step 1: Load stadiums from JSON file
    console.log(`[CHECKPOINT 1] Loading stadiums from: ${STADIUMS_FILE}`);
    if (!fs.existsSync(STADIUMS_FILE)) {
      console.error(`❌ Stadiums file not found: ${STADIUMS_FILE}`);
      process.exit(1);
    }

    const stadiumsData = JSON.parse(
      fs.readFileSync(STADIUMS_FILE, "utf8")
    );
    const apiStadiums = stadiumsData.stadiums || [];

    console.log(
      `✅ Loaded ${apiStadiums.length} stadiums from JSON file\n`
    );

    // Step 2: Connect to database
    console.log("[CHECKPOINT 2] Connecting to database...");
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
    console.log("✅ Connected to database\n");

    // Step 3: Verify each stadium
    console.log("[CHECKPOINT 3] Verifying stadiums in database...\n");

    const results = {
      verified_at: new Date().toISOString(),
      total_stadiums: apiStadiums.length,
      found_in_db: [],
      missing_from_db: [],
      missing_api_football_id: [],
      wrong_api_football_id: [],
      summary: {
        total: 0,
        found: 0,
        missing: 0,
        missing_id: 0,
        wrong_id: 0,
      },
    };

    for (const apiStadium of apiStadiums) {
      const apiFootballId = apiStadium.id;
      const stadiumName = apiStadium.name || "Unknown";
      const city = apiStadium.city || "Unknown";

      // Check if venue exists with this API Football ID
      const venueByApiId = await Venue.findOne({
        "externalIds.apiFootball": apiFootballId,
      }).lean();

      // Also check by venueId in case it's stored there
      const venueByVenueId = await Venue.findOne({
        venueId: apiFootballId,
      }).lean();

      const existingVenue = venueByApiId || venueByVenueId;

      if (existingVenue) {
        // Verify the API Football ID is correct
        const hasCorrectApiId =
          existingVenue.externalIds?.apiFootball === apiFootballId ||
          existingVenue.venueId === apiFootballId;

        if (hasCorrectApiId) {
          // Stadium found with correct ID
          results.found_in_db.push({
            api_football_id: apiFootballId,
            name: stadiumName,
            city: city,
            db_venue_id: existingVenue._id.toString(),
            db_name_en: existingVenue.name_en,
            db_city_en: existingVenue.city_en,
            db_capacity: existingVenue.capacity,
            db_external_id: existingVenue.externalIds?.apiFootball || null,
            db_venue_id_field: existingVenue.venueId,
            match_status: "✅ Found with correct API Football ID",
          });
          results.summary.found++;
        } else {
          // Stadium found but with wrong API Football ID
          results.wrong_api_football_id.push({
            api_football_id: apiFootballId,
            name: stadiumName,
            city: city,
            db_venue_id: existingVenue._id.toString(),
            db_name_en: existingVenue.name_en,
            db_city_en: existingVenue.city_en,
            db_current_api_id: existingVenue.externalIds?.apiFootball || null,
            db_venue_id: existingVenue.venueId,
            expected_api_id: apiFootballId,
            match_status:
              "⚠️ Found but with different API Football ID",
          });
          results.summary.wrong_id++;
        }
      } else {
        // Check if venue exists with same name/city but without API Football ID
        const venueByName = await Venue.findOne({
          name_en: {
            $regex: new RegExp(
              stadiumName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              "i"
            ),
          },
          city_en: {
            $regex: new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
          },
        }).lean();

        if (venueByName) {
          // Stadium exists but missing or wrong API Football ID
          if (
            !venueByName.externalIds?.apiFootball ||
            venueByName.externalIds.apiFootball !== apiFootballId
          ) {
            results.missing_api_football_id.push({
              api_football_id: apiFootballId,
              name: stadiumName,
              city: city,
              db_venue_id: venueByName._id.toString(),
              db_name_en: venueByName.name_en,
              db_city_en: venueByName.city_en,
              db_venue_id: venueByName.venueId,
              db_current_api_id: venueByName.externalIds?.apiFootball || null,
              match_status:
                "⚠️ Found by name/city but missing or has different API Football ID",
            });
            results.summary.missing_id++;
          }
        } else {
          // Stadium completely missing from database
          results.missing_from_db.push({
            api_football_id: apiFootballId,
            name: stadiumName,
            city: city,
            capacity: apiStadium.capacity || null,
            address: apiStadium.address || null,
            teams: apiStadium.teams?.map((t) => t.name).join(", ") || null,
            match_status: "❌ Not found in database",
          });
          results.summary.missing++;
        }
      }
      results.summary.total++;
    }

    // Step 4: Generate summary report
    console.log("=".repeat(80));
    console.log("📊 VERIFICATION SUMMARY");
    console.log("=".repeat(80));
    console.log(`Total stadiums checked: ${results.summary.total}`);
    console.log(`✅ Found with correct ID: ${results.summary.found}`);
    console.log(`❌ Missing from database: ${results.summary.missing}`);
    console.log(
      `⚠️ Missing API Football ID: ${results.summary.missing_id}`
    );
    console.log(
      `⚠️ Wrong API Football ID: ${results.summary.wrong_id}`
    );
    console.log("");

    // Step 5: Display detailed results
    if (results.found_in_db.length > 0) {
      console.log("✅ Stadiums found with correct API Football ID:");
      console.log("-".repeat(80));
      results.found_in_db.forEach((stadium, idx) => {
        console.log(
          `${idx + 1}. ${stadium.name} (ID: ${stadium.api_football_id})`
        );
        console.log(`   DB Name: ${stadium.db_name_en}`);
        console.log(`   City: ${stadium.city}`);
      });
      console.log("");
    }

    if (results.missing_from_db.length > 0) {
      console.log("❌ Stadiums missing from database:");
      console.log("-".repeat(80));
      results.missing_from_db.forEach((stadium, idx) => {
        console.log(
          `${idx + 1}. ${stadium.name} (API ID: ${stadium.api_football_id})`
        );
        console.log(`   City: ${stadium.city}`);
        console.log(`   Capacity: ${stadium.capacity || "N/A"}`);
        console.log(`   Teams: ${stadium.teams || "N/A"}`);
      });
      console.log("");
    }

    if (results.missing_api_football_id.length > 0) {
      console.log("⚠️ Stadiums missing API Football ID:");
      console.log("-".repeat(80));
      results.missing_api_football_id.forEach((stadium, idx) => {
        console.log(
          `${idx + 1}. ${stadium.name} (Expected API ID: ${stadium.api_football_id})`
        );
        console.log(`   DB Name: ${stadium.db_name_en}`);
        console.log(`   City: ${stadium.city}`);
        console.log(`   DB Venue ID: ${stadium.db_venue_id}`);
      });
      console.log("");
    }

    if (results.wrong_api_football_id.length > 0) {
      console.log("⚠️ Stadiums with wrong API Football ID:");
      console.log("-".repeat(80));
      results.wrong_api_football_id.forEach((stadium, idx) => {
        console.log(
          `${idx + 1}. ${stadium.name}`
        );
        console.log(`   Expected API ID: ${stadium.expected_api_id}`);
        console.log(`   Current API ID: ${stadium.db_current_api_id || "None"}`);
        console.log(`   DB Venue ID: ${stadium.db_venue_id}`);
      });
      console.log("");
    }

    // Step 6: Save report to file
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    fs.writeFileSync(
      REPORT_FILE,
      JSON.stringify(results, null, 2),
      "utf8"
    );

    console.log("=".repeat(80));
    console.log("✅ Verification completed!");
    console.log(`📄 Detailed report saved to: ${REPORT_FILE}`);
    console.log("=".repeat(80));

    // Disconnect from database
    await databaseConnection.disconnect();
    console.log("\n✅ Disconnected from database");

    return results;
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error.stack);
    if (databaseConnection.isDatabaseConnected()) {
      await databaseConnection.disconnect();
    }
    throw error;
  }
}

// Run verification
verifyBundesligaStadiums()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

