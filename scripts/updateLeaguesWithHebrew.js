import mongoose from "mongoose";
import League from "../src/models/League.js";
import dotenv from "dotenv";

dotenv.config();

const updateLeaguesWithHebrew = async () => {
  console.log("🔗 Connecting to MongoDB...");
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB.");

    // עדכון הליגות הקיימות עם שמות עבריים והגדרתן כפופולריות
    const leaguesToUpdate = [
      {
        name: "Premier League",
        nameHe: "ליגת הפרמייר ליג",
        country: "England",
        countryHe: "אנגליה",
        isPopular: true,
        logoUrl: "https://media.api-sports.io/football/leagues/39.png",
      },
      {
        name: "La Liga",
        nameHe: "לה ליגה",
        country: "Spain",
        countryHe: "ספרד",
        isPopular: true,
        logoUrl: "https://media.api-sports.io/football/leagues/140.png",
      },
    ];

    for (const leagueData of leaguesToUpdate) {
      const result = await League.updateOne(
        { name: leagueData.name },
        {
          $set: {
            nameHe: leagueData.nameHe,
            countryHe: leagueData.countryHe,
            isPopular: leagueData.isPopular,
            logoUrl: leagueData.logoUrl,
          },
        }
      );

      if (result.matchedCount > 0) {
        console.log(
          `✅ Updated ${leagueData.name} with Hebrew names and marked as popular`
        );
      } else {
        console.log(`⚠️  League ${leagueData.name} not found in database`);
      }
    }

    // בדיקה שהעדכון הצליח
    const popularLeagues = await League.find({ isPopular: true }).lean();
    console.log(`✅ Found ${popularLeagues.length} popular leagues:`);
    popularLeagues.forEach((league) => {
      console.log(
        `  - ${league.name} (${league.nameHe}) - ${league.country} (${league.countryHe})`
      );
    });
  } catch (error) {
    console.error("❌ Error updating leagues:", error);
  } finally {
    console.log("🔌 Disconnected from MongoDB");
    await mongoose.disconnect();
  }
};

updateLeaguesWithHebrew();
