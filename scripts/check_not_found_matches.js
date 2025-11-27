import "dotenv/config";
import mongoose from "mongoose";
import FootballEvent from "../src/models/FootballEvent.js";
import Team from "../src/models/Team.js";
import League from "../src/models/League.js";

async function checkNotFound() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  const bundesliga = await League.findOne({
    $or: [{ slug: "bundesliga" }, { name: /bundesliga/i }],
  });

  const notFoundMatches = [
    {
      apiId: 1388417,
      home: "Borussia Dortmund",
      away: "1899 Hoffenheim",
      date: "2025-12-07",
    },
    {
      apiId: 1388426,
      home: "Bayern München",
      away: "FSV Mainz 05",
      date: "2025-12-14",
    },
    {
      apiId: 1388433,
      home: "Werder Bremen",
      away: "VfB Stuttgart",
      date: "2025-12-14",
    },
  ];

  console.log("=".repeat(80));
  console.log("🔍 Checking Not Found Matches");
  console.log("=".repeat(80));
  console.log("");

  for (const matchInfo of notFoundMatches) {
    // Find teams
    const homeTeam = await Team.findOne({
      $or: [
        { name_en: matchInfo.home },
        { name: matchInfo.home },
        { name_en: { $regex: matchInfo.home, $options: "i" } },
      ],
    }).lean();

    const awayTeam = await Team.findOne({
      $or: [
        { name_en: matchInfo.away },
        { name: matchInfo.away },
        { name_en: { $regex: matchInfo.away, $options: "i" } },
      ],
    }).lean();

    if (!homeTeam || !awayTeam) {
      console.log(`❌ Teams not found for ${matchInfo.home} vs ${matchInfo.away}`);
      continue;
    }

    // Search without date filter
    const matches = await FootballEvent.find({
      $or: [
        { homeTeam: homeTeam._id, awayTeam: awayTeam._id },
        { homeTeam: awayTeam._id, awayTeam: homeTeam._id },
      ],
      league: bundesliga._id,
    })
      .populate("homeTeam", "name name_en")
      .populate("awayTeam", "name name_en")
      .sort({ date: 1 })
      .lean();

    console.log(`API ID: ${matchInfo.apiId}`);
    console.log(`  Looking for: ${matchInfo.home} vs ${matchInfo.away} (${matchInfo.date})`);
    console.log(`  Found ${matches.length} match(es) with these teams:`);

    matches.forEach((m, idx) => {
      const matchDate = new Date(m.date).toISOString().split("T")[0];
      const isReversed =
        m.homeTeam._id.toString() === awayTeam._id.toString();
      console.log(
        `    ${idx + 1}. ${m.homeTeam?.name_en || m.homeTeam?.name} vs ${m.awayTeam?.name_en || m.awayTeam?.name} (${matchDate})${isReversed ? " [REVERSED]" : ""}`
      );
    });
    console.log("");
  }

  await mongoose.disconnect();
  console.log("Disconnected from MongoDB");
}

checkNotFound();



