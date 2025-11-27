import dotenv from "dotenv";
import mongoose from "mongoose";
import FootballEvent from "../src/models/FootballEvent.js";
import League from "../src/models/League.js";

dotenv.config();

async function checkSerieAMatches() {
  try {
    console.log("🔌 Connecting to database...");
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("❌ MONGODB_URI not found in environment variables");
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to database");
    console.log("");

    // Find Serie A league
    const serieA = await League.findOne({
      $or: [
        { "externalIds.apiFootball": 135 },
        { slug: "serie-a" },
        { name: { $regex: /serie a/i } },
      ],
    });

    if (!serieA) {
      console.log("❌ Serie A league not found in database");
      await databaseConnection.disconnect();
      process.exit(1);
    }

    console.log(`✅ Found league: ${serieA.name} (${serieA.nameHe || "N/A"})`);
    console.log(`   League ID: ${serieA._id}`);
    console.log("");

    // Count matches
    const totalMatches = await FootballEvent.countDocuments({
      league: serieA._id,
    });

    console.log(`📊 Total matches in database: ${totalMatches}`);
    console.log("");

    if (totalMatches > 0) {
      // Get sample matches (without populate to avoid schema issues)
      const sampleMatches = await FootballEvent.find({
        league: serieA._id,
      })
        .sort({ date: 1 })
        .limit(10)
        .lean();

      console.log("📋 Sample matches (first 10):");
      console.log("");
      sampleMatches.forEach((match, index) => {
        const date = new Date(match.date).toLocaleDateString("he-IL");
        const status = match.status || "N/A";
        const round = match.round || "N/A";

        console.log(`${index + 1}. Match ID: ${match._id}`);
        console.log(`   Date: ${date}`);
        console.log(`   Status: ${status}`);
        console.log(`   Round: ${round}`);
        console.log(`   Slug: ${match.slug || "N/A"}`);
        console.log(`   Home Team ID: ${match.homeTeam}`);
        console.log(`   Away Team ID: ${match.awayTeam}`);
        console.log(`   Venue ID: ${match.venue}`);
        console.log("");
      });

      // Get date range
      const dateRange = await FootballEvent.aggregate([
        { $match: { league: serieA._id } },
        {
          $group: {
            _id: null,
            minDate: { $min: "$date" },
            maxDate: { $max: "$date" },
          },
        },
      ]);

      if (dateRange.length > 0) {
        const minDate = new Date(dateRange[0].minDate).toLocaleDateString(
          "he-IL"
        );
        const maxDate = new Date(dateRange[0].maxDate).toLocaleDateString(
          "he-IL"
        );
        console.log(`📅 Date range: ${minDate} - ${maxDate}`);
        console.log("");
      }

      // Count by status
      const statusCount = await FootballEvent.aggregate([
        { $match: { league: serieA._id } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]);

      if (statusCount.length > 0) {
        console.log("📊 Matches by status:");
        statusCount.forEach((item) => {
          console.log(`   ${item._id || "N/A"}: ${item.count}`);
        });
        console.log("");
      }
    } else {
      console.log("ℹ️  No matches found for Serie A");
      console.log("   You may need to run create_seriea_matches.js");
    }

    await mongoose.connection.close();
    console.log("✅ Disconnected from database");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

checkSerieAMatches();

