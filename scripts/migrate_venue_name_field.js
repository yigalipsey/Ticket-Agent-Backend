import dotenv from "dotenv";
import Venue from "../src/models/Venue.js";
import databaseConnection from "../src/config/database.js";

dotenv.config();

/**
 * Migrate venue names: move name_en/name_he to name field, remove name_en and name_he
 */
async function migrateVenueNameField() {
  try {
    console.log("=".repeat(80));
    console.log("🔄 Migrating venue name field");
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
    let errors = [];

    // Process each venue
    for (let i = 0; i < venues.length; i++) {
      const venue = venues[i];
      const progress = `[${i + 1}/${venues.length}]`;

      try {
        // Determine the Hebrew name to use
        let hebrewName = null;

        // Priority: name_he > name_en (if name_en contains Hebrew) > name_en
        if (venue.name_he && venue.name_he.trim()) {
          hebrewName = venue.name_he.trim();
        } else if (venue.name_en) {
          // Check if name_en already contains Hebrew
          const hasHebrew = /[\u0590-\u05FF]/.test(venue.name_en);
          if (hasHebrew) {
            hebrewName = venue.name_en.trim();
          } else {
            // name_en is in English, we'll need to translate it
            // For now, use name_en as fallback (user can translate later)
            hebrewName = venue.name_en.trim();
            console.log(
              `${progress} ⚠️  Venue ${venue.venueId}: name_en is in English, using as fallback: "${hebrewName}"`
            );
          }
        } else if (venue.name) {
          // If name field already exists, check if it's Hebrew
          const hasHebrew = /[\u0590-\u05FF]/.test(venue.name);
          if (hasHebrew) {
            hebrewName = venue.name.trim();
          } else {
            hebrewName = venue.name.trim();
            console.log(
              `${progress} ⚠️  Venue ${venue.venueId}: name field is in English, using as fallback: "${hebrewName}"`
            );
          }
        }

        if (!hebrewName) {
          console.log(
            `${progress} ❌ Venue ${venue.venueId}: No name found, skipping`
          );
          errors.push({
            venueId: venue.venueId,
            error: "No name found",
          });
          continue;
        }

        // Update venue: set name to Hebrew name, remove name_en and name_he
        await Venue.updateOne(
          { _id: venue._id },
          {
            $set: { name: hebrewName },
            $unset: { name_en: "", name_he: "" },
          }
        );

        updatedCount++;
        console.log(
          `${progress} ✅ Venue ${venue.venueId}: Set name to "${hebrewName}"`
        );
      } catch (error) {
        console.error(
          `${progress} ❌ Error processing venue ${venue.venueId}:`,
          error.message
        );
        errors.push({
          venueId: venue.venueId,
          error: error.message,
        });
      }
    }

    console.log("");
    console.log("=".repeat(80));
    console.log("📊 Migration Summary");
    console.log("=".repeat(80));
    console.log(`✅ Successfully updated: ${updatedCount}`);
    console.log(`❌ Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log("");
      console.log("❌ Errors details:");
      errors.forEach((err) => {
        console.log(`   - Venue ${err.venueId}: ${err.error}`);
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
migrateVenueNameField()
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


