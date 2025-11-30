import "dotenv/config";
import mongoose from "mongoose";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";

async function verifyReversed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  // Sample reversed matches from report
  const reversedMatches = [
    {
      apiId: 1388416,
      dbId: "6926e32fa3a933930dad459d",
      json: { home: "FC Augsburg", away: "Bayer Leverkusen" },
    },
    {
      apiId: 1388423,
      dbId: "6926e32fa3a933930dad45c2",
      json: { home: "VfB Stuttgart", away: "Bayern München" },
    },
    {
      apiId: 1388420,
      dbId: "6926e32fa3a933930dad45b7",
      json: { home: "1. FC Heidenheim", away: "SC Freiburg" },
    },
    {
      apiId: 1388418,
      dbId: "6926e32fa3a933930dad45bc",
      json: { home: "1.FC Köln", away: "FC St. Pauli" },
    },
    {
      apiId: 1388419,
      dbId: "6926e32fa3a933930dad45c6",
      json: { home: "Hamburger SV", away: "Werder Bremen" },
    },
  ];

  console.log("=".repeat(80));
  console.log("🔍 Verifying Reversed Matches");
  console.log("=".repeat(80));
  console.log("");

  for (const matchInfo of reversedMatches) {
    const dbMatch = await FootballEvent.findById(matchInfo.dbId)
      .populate("homeTeam", "name name_en apiFootballId")
      .populate("awayTeam", "name name_en apiFootballId")
      .lean();

    if (!dbMatch) {
      console.log(`❌ Match ${matchInfo.dbId} not found`);
      continue;
    }

    const dbHome = dbMatch.homeTeam?.name_en || dbMatch.homeTeam?.name;
    const dbAway = dbMatch.awayTeam?.name_en || dbMatch.awayTeam?.name;
    const dbHomeApiId = dbMatch.homeTeam?.apiFootballId;
    const dbAwayApiId = dbMatch.awayTeam?.apiFootballId;

    console.log(`API ID: ${matchInfo.apiId}`);
    console.log(`  JSON: ${matchInfo.json.home} vs ${matchInfo.json.away}`);
    console.log(`  DB:   ${dbHome} vs ${dbAway}`);
    console.log(`  DB Home API ID: ${dbHomeApiId}, Away API ID: ${dbAwayApiId}`);

    // Check if truly reversed
    const jsonHomeApiId = await Team.findOne({
      $or: [
        { name_en: matchInfo.json.home },
        { name: matchInfo.json.home },
        { name_en: { $regex: matchInfo.json.home, $options: "i" } },
      ],
    })
      .select("apiFootballId")
      .lean();

    const jsonAwayApiId = await Team.findOne({
      $or: [
        { name_en: matchInfo.json.away },
        { name: matchInfo.json.away },
        { name_en: { $regex: matchInfo.json.away, $options: "i" } },
      ],
    })
      .select("apiFootballId")
      .lean();

    if (
      jsonHomeApiId?.apiFootballId === dbAwayApiId &&
      jsonAwayApiId?.apiFootballId === dbHomeApiId
    ) {
      console.log(`  ✅ CONFIRMED REVERSED`);
    } else {
      console.log(`  ⚠️  Need to check manually`);
    }
    console.log("");
  }

  await mongoose.disconnect();
  console.log("Disconnected from MongoDB");
}

verifyReversed();




