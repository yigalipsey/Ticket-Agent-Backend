import dotenv from "dotenv";
import Venue from "../src/models/Venue.js";
import databaseConnection from "../src/config/database.js";
import axios from "axios";

dotenv.config();

// Google Translate API configuration
const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const GOOGLE_TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2";

/**
 * Translate text from English to Hebrew using Google Translate API
 * @param {string} text - Text to translate
 * @returns {Promise<string>} - Translated text
 */
async function translateToHebrew(text) {
  if (!GOOGLE_TRANSLATE_API_KEY) {
    console.warn("⚠️  GOOGLE_TRANSLATE_API_KEY not found, using fallback translation");
    // Fallback: return text as-is (user will need to manually translate)
    return text;
  }

  try {
    const response = await axios.post(
      GOOGLE_TRANSLATE_URL,
      {
        q: text,
        target: "he",
        source: "en",
        key: GOOGLE_TRANSLATE_API_KEY,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    if (response.data?.data?.translations?.[0]?.translatedText) {
      return response.data.data.translations[0].translatedText;
    }

    throw new Error("Invalid response from Google Translate API");
  } catch (error) {
    console.error(`❌ Error translating "${text}":`, error.message);
    // Fallback: return original text
    return text;
  }
}

/**
 * Migrate venue names: replace name_en with name_he, translate if missing, remove name_he
 */
async function migrateVenueNames() {
  try {
    console.log("=".repeat(80));
    console.log("🔄 Starting venue name migration");
    console.log("=".repeat(80));
    console.log("");

    // Connect to database
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("❌ MONGODB_URI not found in environment variables");
      process.exit(1);
    }

    await databaseConnection.connect(mongoUri);
    console.log("✅ Connected to database");
    console.log("");

    // Fetch all venues
    const venues = await Venue.find({}).lean();
    console.log(`📊 Found ${venues.length} venues to process`);
    console.log("");

    let updatedCount = 0;
    let translatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Process each venue
    for (let i = 0; i < venues.length; i++) {
      const venue = venues[i];
      const progress = `[${i + 1}/${venues.length}]`;

      try {
        let newNameEn = venue.name_en;
        let needsTranslation = false;

        // Check if name_he exists and is different from name_en
        if (venue.name_he && venue.name_he.trim() && venue.name_he !== venue.name_en) {
          // Use name_he as the new name_en
          newNameEn = venue.name_he.trim();
          console.log(
            `${progress} ✅ Venue ${venue.venueId}: Using existing Hebrew name "${newNameEn}"`
          );
        } else if (!venue.name_he || !venue.name_he.trim()) {
          // Need to translate name_en to Hebrew
          needsTranslation = true;
          console.log(
            `${progress} 🌐 Venue ${venue.venueId}: Translating "${venue.name_en}" to Hebrew...`
          );
          newNameEn = await translateToHebrew(venue.name_en);
          
          if (newNameEn === venue.name_en && GOOGLE_TRANSLATE_API_KEY) {
            console.warn(
              `   ⚠️  Translation returned same text, keeping original`
            );
          } else {
            translatedCount++;
            console.log(`   ✅ Translated to: "${newNameEn}"`);
          }
        } else {
          // name_he exists but is same as name_en, just remove name_he
          console.log(
            `${progress} ⏭️  Venue ${venue.venueId}: name_he same as name_en, removing name_he`
          );
        }

        // Update venue: set name_en to new value and remove name_he
        await Venue.updateOne(
          { _id: venue._id },
          {
            $set: { name_en: newNameEn },
            $unset: { name_he: "" },
          }
        );

        updatedCount++;

        // Add small delay to avoid rate limiting (if using API)
        if (needsTranslation && i < venues.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(
          `${progress} ❌ Error processing venue ${venue.venueId}:`,
          error.message
        );
        errors.push({
          venueId: venue.venueId,
          name_en: venue.name_en,
          error: error.message,
        });
        skippedCount++;
      }
    }

    console.log("");
    console.log("=".repeat(80));
    console.log("📊 Migration Summary");
    console.log("=".repeat(80));
    console.log(`✅ Successfully updated: ${updatedCount}`);
    console.log(`🌐 Translated: ${translatedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log("");
      console.log("❌ Errors details:");
      errors.forEach((err) => {
        console.log(`   - Venue ${err.venueId} (${err.name_en}): ${err.error}`);
      });
    }

    console.log("");
    console.log("✅ Migration completed!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await databaseConnection.disconnect();
    console.log("✅ Database connection closed");
  }
}

// Run migration
migrateVenueNames()
  .then(() => {
    console.log("");
    console.log("🎉 Migration script finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("");
    console.error("💥 Migration script failed:", error);
    process.exit(1);
  });


