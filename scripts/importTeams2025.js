import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Import models
import Team from "../src/models/Team.js";
import Venue from "../src/models/Venue.js";

// La Liga teams data from API response (Season 2025)
const laLigaTeams = [
  {
    name: "Barcelona",
    code: "BAR",
    country: "Spain",
    founded: 1899,
    logoUrl: "https://media.api-sports.io/football/teams/529.png",
    teamId: 529,
    venueId: 19939,
    externalIds: { apiFootball: 529 },
  },
  {
    name: "Atletico Madrid",
    code: "MAD",
    country: "Spain",
    founded: 1903,
    logoUrl: "https://media.api-sports.io/football/teams/530.png",
    teamId: 530,
    venueId: 19217,
    externalIds: { apiFootball: 530 },
  },
  {
    name: "Athletic Club",
    code: "BIL",
    country: "Spain",
    founded: 1898,
    logoUrl: "https://media.api-sports.io/football/teams/531.png",
    teamId: 531,
    venueId: 1460,
    externalIds: { apiFootball: 531 },
  },
  {
    name: "Valencia",
    code: "VAL",
    country: "Spain",
    founded: 1919,
    logoUrl: "https://media.api-sports.io/football/teams/532.png",
    teamId: 532,
    venueId: 1497,
    externalIds: { apiFootball: 532 },
  },
  {
    name: "Villarreal",
    code: "VIL",
    country: "Spain",
    founded: 1923,
    logoUrl: "https://media.api-sports.io/football/teams/533.png",
    teamId: 533,
    venueId: 1498,
    externalIds: { apiFootball: 533 },
  },
  {
    name: "Sevilla",
    code: "SEV",
    country: "Spain",
    founded: 1890,
    logoUrl: "https://media.api-sports.io/football/teams/536.png",
    teamId: 536,
    venueId: 1494,
    externalIds: { apiFootball: 536 },
  },
  {
    name: "Celta Vigo",
    code: "CEL",
    country: "Spain",
    founded: 1923,
    logoUrl: "https://media.api-sports.io/football/teams/538.png",
    teamId: 538,
    venueId: 1467,
    externalIds: { apiFootball: 538 },
  },
  {
    name: "Levante",
    code: "LEV",
    country: "Spain",
    founded: 1909,
    logoUrl: "https://media.api-sports.io/football/teams/539.png",
    teamId: 539,
    venueId: 1482,
    externalIds: { apiFootball: 539 },
  },
  {
    name: "Espanyol",
    code: "ESP",
    country: "Spain",
    founded: 1900,
    logoUrl: "https://media.api-sports.io/football/teams/540.png",
    teamId: 540,
    venueId: 20421,
    externalIds: { apiFootball: 540 },
  },
  {
    name: "Real Madrid",
    code: "REA",
    country: "Spain",
    founded: 1902,
    logoUrl: "https://media.api-sports.io/football/teams/541.png",
    teamId: 541,
    venueId: 1456,
    externalIds: { apiFootball: 541 },
  },
  {
    name: "Alaves",
    code: "ALA",
    country: "Spain",
    founded: 1921,
    logoUrl: "https://media.api-sports.io/football/teams/542.png",
    teamId: 542,
    venueId: 1470,
    externalIds: { apiFootball: 542 },
  },
  {
    name: "Real Betis",
    code: "BET",
    country: "Spain",
    founded: 1907,
    logoUrl: "https://media.api-sports.io/football/teams/543.png",
    teamId: 543,
    venueId: 1489,
    externalIds: { apiFootball: 543 },
  },
  {
    name: "Getafe",
    code: "GET",
    country: "Spain",
    founded: 1983,
    logoUrl: "https://media.api-sports.io/football/teams/546.png",
    teamId: 546,
    venueId: 20422,
    externalIds: { apiFootball: 546 },
  },
  {
    name: "Girona",
    code: "GIR",
    country: "Spain",
    founded: 1930,
    logoUrl: "https://media.api-sports.io/football/teams/547.png",
    teamId: 547,
    venueId: 1478,
    externalIds: { apiFootball: 547 },
  },
  {
    name: "Real Sociedad",
    code: "RSO",
    country: "Spain",
    founded: 1909,
    logoUrl: "https://media.api-sports.io/football/teams/548.png",
    teamId: 548,
    venueId: 1491,
    externalIds: { apiFootball: 548 },
  },
  {
    name: "Oviedo",
    code: "OVI",
    country: "Spain",
    founded: 1926,
    logoUrl: "https://media.api-sports.io/football/teams/718.png",
    teamId: 718,
    venueId: 1490,
    externalIds: { apiFootball: 718 },
  },
  {
    name: "Osasuna",
    code: "OSA",
    country: "Spain",
    founded: 1920,
    logoUrl: "https://media.api-sports.io/football/teams/727.png",
    teamId: 727,
    venueId: 1486,
    externalIds: { apiFootball: 727 },
  },
  {
    name: "Rayo Vallecano",
    code: "RAY",
    country: "Spain",
    founded: 1924,
    logoUrl: "https://media.api-sports.io/football/teams/728.png",
    teamId: 728,
    venueId: 1488,
    externalIds: { apiFootball: 728 },
  },
  {
    name: "Elche",
    code: "ELC",
    country: "Spain",
    founded: 1923,
    logoUrl: "https://media.api-sports.io/football/teams/797.png",
    teamId: 797,
    venueId: 1473,
    externalIds: { apiFootball: 797 },
  },
  {
    name: "Mallorca",
    code: "MAL",
    country: "Spain",
    founded: 1916,
    logoUrl: "https://media.api-sports.io/football/teams/798.png",
    teamId: 798,
    venueId: 19940,
    externalIds: { apiFootball: 798 },
  },
];

// Premier League teams data from API response (Season 2025)
const premierLeagueTeams = [
  {
    name: "Manchester United",
    code: "MUN",
    country: "England",
    founded: 1878,
    logoUrl: "https://media.api-sports.io/football/teams/33.png",
    teamId: 33,
    venueId: 556,
    externalIds: { apiFootball: 33 },
  },
  {
    name: "Newcastle",
    code: "NEW",
    country: "England",
    founded: 1892,
    logoUrl: "https://media.api-sports.io/football/teams/34.png",
    teamId: 34,
    venueId: 562,
    externalIds: { apiFootball: 34 },
  },
  {
    name: "Bournemouth",
    code: "BOU",
    country: "England",
    founded: 1899,
    logoUrl: "https://media.api-sports.io/football/teams/35.png",
    teamId: 35,
    venueId: 504,
    externalIds: { apiFootball: 35 },
  },
  {
    name: "Fulham",
    code: "FUL",
    country: "England",
    founded: 1879,
    logoUrl: "https://media.api-sports.io/football/teams/36.png",
    teamId: 36,
    venueId: 535,
    externalIds: { apiFootball: 36 },
  },
  {
    name: "Wolves",
    code: "WOL",
    country: "England",
    founded: 1877,
    logoUrl: "https://media.api-sports.io/football/teams/39.png",
    teamId: 39,
    venueId: 600,
    externalIds: { apiFootball: 39 },
  },
  {
    name: "Liverpool",
    code: "LIV",
    country: "England",
    founded: 1892,
    logoUrl: "https://media.api-sports.io/football/teams/40.png",
    teamId: 40,
    venueId: 550,
    externalIds: { apiFootball: 40 },
  },
  {
    name: "Arsenal",
    code: "ARS",
    country: "England",
    founded: 1886,
    logoUrl: "https://media.api-sports.io/football/teams/42.png",
    teamId: 42,
    venueId: 494,
    externalIds: { apiFootball: 42 },
  },
  {
    name: "Burnley",
    code: "BUR",
    country: "England",
    founded: 1882,
    logoUrl: "https://media.api-sports.io/football/teams/44.png",
    teamId: 44,
    venueId: 512,
    externalIds: { apiFootball: 44 },
  },
  {
    name: "Everton",
    code: "EVE",
    country: "England",
    founded: 1878,
    logoUrl: "https://media.api-sports.io/football/teams/45.png",
    teamId: 45,
    venueId: 22033,
    externalIds: { apiFootball: 45 },
  },
  {
    name: "Tottenham",
    code: "TOT",
    country: "England",
    founded: 1882,
    logoUrl: "https://media.api-sports.io/football/teams/47.png",
    teamId: 47,
    venueId: 593,
    externalIds: { apiFootball: 47 },
  },
  {
    name: "West Ham",
    code: "WES",
    country: "England",
    founded: 1895,
    logoUrl: "https://media.api-sports.io/football/teams/48.png",
    teamId: 48,
    venueId: 598,
    externalIds: { apiFootball: 48 },
  },
  {
    name: "Chelsea",
    code: "CHE",
    country: "England",
    founded: 1905,
    logoUrl: "https://media.api-sports.io/football/teams/49.png",
    teamId: 49,
    venueId: 519,
    externalIds: { apiFootball: 49 },
  },
  {
    name: "Manchester City",
    code: "MAC",
    country: "England",
    founded: 1880,
    logoUrl: "https://media.api-sports.io/football/teams/50.png",
    teamId: 50,
    venueId: 555,
    externalIds: { apiFootball: 50 },
  },
  {
    name: "Brighton",
    code: "BRI",
    country: "England",
    founded: 1901,
    logoUrl: "https://media.api-sports.io/football/teams/51.png",
    teamId: 51,
    venueId: 508,
    externalIds: { apiFootball: 51 },
  },
  {
    name: "Crystal Palace",
    code: "CRY",
    country: "England",
    founded: 1861,
    logoUrl: "https://media.api-sports.io/football/teams/52.png",
    teamId: 52,
    venueId: 525,
    externalIds: { apiFootball: 52 },
  },
  {
    name: "Brentford",
    code: "BRE",
    country: "England",
    founded: 1889,
    logoUrl: "https://media.api-sports.io/football/teams/55.png",
    teamId: 55,
    venueId: 10503,
    externalIds: { apiFootball: 55 },
  },
  {
    name: "Leeds",
    code: "LEE",
    country: "England",
    founded: 1919,
    logoUrl: "https://media.api-sports.io/football/teams/63.png",
    teamId: 63,
    venueId: 546,
    externalIds: { apiFootball: 63 },
  },
  {
    name: "Nottingham Forest",
    code: "NOT",
    country: "England",
    founded: 1865,
    logoUrl: "https://media.api-sports.io/football/teams/65.png",
    teamId: 65,
    venueId: 566,
    externalIds: { apiFootball: 65 },
  },
  {
    name: "Aston Villa",
    code: "AST",
    country: "England",
    founded: 1874,
    logoUrl: "https://media.api-sports.io/football/teams/66.png",
    teamId: 66,
    venueId: 495,
    externalIds: { apiFootball: 66 },
  },
  {
    name: "Sunderland",
    code: "SUN",
    country: "England",
    founded: 1879,
    logoUrl: "https://media.api-sports.io/football/teams/746.png",
    teamId: 746,
    venueId: 589,
    externalIds: { apiFootball: 746 },
  },
];

// Combine all teams
const allTeams = [...laLigaTeams, ...premierLeagueTeams];

async function importTeams2025() {
  try {
    console.log("🔄 Connecting to MongoDB...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    console.log("🔄 Importing teams for season 2025...");

    const importedTeams = [];
    const skippedTeams = [];

    for (const teamData of allTeams) {
      try {
        // Check if team already exists by external ID
        const existingTeam = await Team.findOne({
          "externalIds.apiFootball": teamData.externalIds.apiFootball,
        });

        if (existingTeam) {
          console.log(`⚠️  Team already exists: ${teamData.name}`);
          skippedTeams.push(teamData.name);
          continue;
        }

        // Check if venue exists
        const venue = await Venue.findOne({
          "externalIds.apiFootball": teamData.venueId,
        });

        if (!venue) {
          console.log(
            `❌ Venue not found for team ${teamData.name} (venueId: ${teamData.venueId})`
          );
          continue;
        }

        // Create slug from team name
        const slug = teamData.name
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .replace(/\s+/g, "-")
          .trim();

        // Create team document
        const team = new Team({
          name: teamData.name,
          code: teamData.code,
          country: teamData.country,
          logoUrl: teamData.logoUrl,
          teamId: teamData.teamId,
          venueId: venue._id, // Use the venue's MongoDB _id
          externalIds: teamData.externalIds,
          slug: slug,
        });

        await team.save();
        importedTeams.push(team);

        console.log(
          `✅ Imported: ${team.name} (${team.country}) - ${team.code} - Venue: ${venue.name}`
        );
      } catch (error) {
        console.error(
          `❌ Failed to import team ${teamData.name}:`,
          error.message
        );
      }
    }

    console.log(`🎉 Successfully imported ${importedTeams.length} teams`);
    console.log(`⚠️  Skipped ${skippedTeams.length} existing teams`);

    // Show statistics
    const totalTeams = await Team.countDocuments();
    console.log(`📈 Total teams in database: ${totalTeams}`);

    // Show teams by country
    const teamsByCountry = await Team.aggregate([
      {
        $group: {
          _id: "$country",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    console.log("\n🌍 Teams by Country:");
    teamsByCountry.forEach((country) => {
      console.log(`  - ${country._id}: ${country.count} teams`);
    });

    // Show some examples
    const sampleTeams = await Team.find({})
      .populate("venueId", "name city capacity")
      .limit(5)
      .select("name code country logoUrl venueId");
    console.log("\n📋 Sample teams:");
    sampleTeams.forEach((team) => {
      console.log(
        `  - ${team.name} (${team.code}) - ${team.country} - Venue: ${
          team.venueId?.name || "N/A"
        }`
      );
    });

    // Show teams with their venues
    const teamsWithVenues = await Team.aggregate([
      {
        $lookup: {
          from: "venues",
          localField: "venueId",
          foreignField: "_id",
          as: "venue",
        },
      },
      {
        $unwind: "$venue",
      },
      {
        $group: {
          _id: "$country",
          teams: {
            $push: {
              name: "$name",
              venue: "$venue.name",
              capacity: "$venue.capacity",
            },
          },
        },
      },
    ]);

    console.log("\n🏟️  Teams with Venues by Country:");
    teamsWithVenues.forEach((country) => {
      console.log(`\n${country._id}:`);
      country.teams.forEach((team) => {
        console.log(
          `  - ${team.name} → ${
            team.venue
          } (${team.capacity.toLocaleString()} seats)`
        );
      });
    });
  } catch (error) {
    console.error("❌ Error importing teams:", error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run the import
importTeams2025();
