import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Import Venue model
import Venue from "../src/models/Venue.js";

// Premier League venues data from API response (Season 2025)
const premierLeagueVenues = [
  {
    name: "Old Trafford",
    address: "Sir Matt Busby Way",
    city: "Manchester",
    country: "England",
    capacity: 76212,
    venueId: 556,
    image: "https://media.api-sports.io/football/venues/556.png",
    externalIds: { apiFootball: 556 },
  },
  {
    name: "St. James' Park",
    address: "St. James' Street",
    city: "Newcastle upon Tyne",
    country: "England",
    capacity: 52758,
    venueId: 562,
    image: "https://media.api-sports.io/football/venues/562.png",
    externalIds: { apiFootball: 562 },
  },
  {
    name: "Vitality Stadium",
    address: "Dean Court, Kings Park",
    city: "Bournemouth, Dorset",
    country: "England",
    capacity: 12000,
    venueId: 504,
    image: "https://media.api-sports.io/football/venues/504.png",
    externalIds: { apiFootball: 504 },
  },
  {
    name: "Craven Cottage",
    address: "Stevenage Road",
    city: "London",
    country: "England",
    capacity: 29589,
    venueId: 535,
    image: "https://media.api-sports.io/football/venues/535.png",
    externalIds: { apiFootball: 535 },
  },
  {
    name: "Molineux Stadium",
    address: "Waterloo Road",
    city: "Wolverhampton, West Midlands",
    country: "England",
    capacity: 34624,
    venueId: 600,
    image: "https://media.api-sports.io/football/venues/600.png",
    externalIds: { apiFootball: 600 },
  },
  {
    name: "Anfield",
    address: "Anfield Road",
    city: "Liverpool",
    country: "England",
    capacity: 61276,
    venueId: 550,
    image: "https://media.api-sports.io/football/venues/550.png",
    externalIds: { apiFootball: 550 },
  },
  {
    name: "Emirates Stadium",
    address: "Hornsey Road",
    city: "London",
    country: "England",
    capacity: 60383,
    venueId: 494,
    image: "https://media.api-sports.io/football/venues/494.png",
    externalIds: { apiFootball: 494 },
  },
  {
    name: "Turf Moor",
    address: "Harry Potts Way",
    city: "Burnley",
    country: "England",
    capacity: 22546,
    venueId: 512,
    image: "https://media.api-sports.io/football/venues/512.png",
    externalIds: { apiFootball: 512 },
  },
  {
    name: "Hill Dickinson Stadium",
    address: "35 Regent Road, Bramley-Moore Dock, Vauxhall",
    city: "Liverpool, Merseyside",
    country: "England",
    capacity: 52888,
    venueId: 22033,
    image: "https://media.api-sports.io/football/venues/22033.png",
    externalIds: { apiFootball: 22033 },
  },
  {
    name: "Tottenham Hotspur Stadium",
    address: "Bill Nicholson Way, 748 High Road",
    city: "London",
    country: "England",
    capacity: 62850,
    venueId: 593,
    image: "https://media.api-sports.io/football/venues/593.png",
    externalIds: { apiFootball: 593 },
  },
  {
    name: "London Stadium",
    address: "Marshgate Lane, Stratford",
    city: "London",
    country: "England",
    capacity: 64472,
    venueId: 598,
    image: "https://media.api-sports.io/football/venues/598.png",
    externalIds: { apiFootball: 598 },
  },
  {
    name: "Stamford Bridge",
    address: "Fulham Road",
    city: "London",
    country: "England",
    capacity: 41841,
    venueId: 519,
    image: "https://media.api-sports.io/football/venues/519.png",
    externalIds: { apiFootball: 519 },
  },
  {
    name: "Etihad Stadium",
    address: "Rowsley Street",
    city: "Manchester",
    country: "England",
    capacity: 55097,
    venueId: 555,
    image: "https://media.api-sports.io/football/venues/555.png",
    externalIds: { apiFootball: 555 },
  },
  {
    name: "American Express Stadium",
    address: "Village Way",
    city: "Falmer, East Sussex",
    country: "England",
    capacity: 31872,
    venueId: 508,
    image: "https://media.api-sports.io/football/venues/508.png",
    externalIds: { apiFootball: 508 },
  },
  {
    name: "Selhurst Park",
    address: "Holmesdale Road",
    city: "London",
    country: "England",
    capacity: 26309,
    venueId: 525,
    image: "https://media.api-sports.io/football/venues/525.png",
    externalIds: { apiFootball: 525 },
  },
  {
    name: "Gtech Community Stadium",
    address: "166 Lionel Rd N, Brentford",
    city: "Brentford, Middlesex",
    country: "England",
    capacity: 17250,
    venueId: 10503,
    image: "https://media.api-sports.io/football/venues/10503.png",
    externalIds: { apiFootball: 10503 },
  },
  {
    name: "Elland Road",
    address: "Elland Road",
    city: "Leeds, West Yorkshire",
    country: "England",
    capacity: 40204,
    venueId: 546,
    image: "https://media.api-sports.io/football/venues/546.png",
    externalIds: { apiFootball: 546 },
  },
  {
    name: "The City Ground",
    address: "Pavilion Road",
    city: "Nottingham, Nottinghamshire",
    country: "England",
    capacity: 30576,
    venueId: 566,
    image: "https://media.api-sports.io/football/venues/566.png",
    externalIds: { apiFootball: 566 },
  },
  {
    name: "Villa Park",
    address: "Trinity Road",
    city: "Birmingham",
    country: "England",
    capacity: 42824,
    venueId: 495,
    image: "https://media.api-sports.io/football/venues/495.png",
    externalIds: { apiFootball: 495 },
  },
  {
    name: "Stadium of Light",
    address: "Millenium Way",
    city: "Sunderland",
    country: "England",
    capacity: 49000,
    venueId: 589,
    image: "https://media.api-sports.io/football/venues/589.png",
    externalIds: { apiFootball: 589 },
  },
];

async function importPremierLeagueVenues() {
  try {
    console.log("🔄 Connecting to MongoDB...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    console.log("🔄 Importing Premier League venues...");

    const importedVenues = [];

    for (const venueData of premierLeagueVenues) {
      try {
        // Check if venue already exists by external ID
        const existingVenue = await Venue.findOne({
          "externalIds.apiFootball": venueData.externalIds.apiFootball,
        });

        if (existingVenue) {
          console.log(`⚠️  Venue already exists: ${venueData.name}`);
          continue;
        }

        // Create venue document
        const venue = new Venue({
          name: venueData.name,
          address: venueData.address,
          city: venueData.city,
          country: venueData.country,
          capacity: venueData.capacity,
          venueId: venueData.venueId,
          image: venueData.image,
          externalIds: venueData.externalIds,
        });

        await venue.save();
        importedVenues.push(venue);

        console.log(
          `✅ Imported: ${venue.name} (${venue.city}) - ${venue.capacity} seats`
        );
      } catch (error) {
        console.error(
          `❌ Failed to import venue ${venueData.name}:`,
          error.message
        );
      }
    }

    console.log(`🎉 Successfully imported ${importedVenues.length} venues`);

    // Show statistics
    const totalVenues = await Venue.countDocuments();
    console.log(`📈 Total venues in database: ${totalVenues}`);

    // Show some examples
    const sampleVenues = await Venue.find({})
      .limit(5)
      .select("name city capacity image");
    console.log("📋 Sample venues:");
    sampleVenues.forEach((venue) => {
      console.log(
        `  - ${venue.name} (${venue.city}) - ${venue.capacity} seats - ${venue.image}`
      );
    });

    // Show capacity statistics
    const capacityStats = await Venue.aggregate([
      {
        $group: {
          _id: null,
          totalCapacity: { $sum: "$capacity" },
          avgCapacity: { $avg: "$capacity" },
          maxCapacity: { $max: "$capacity" },
          minCapacity: { $min: "$capacity" },
        },
      },
    ]);

    if (capacityStats.length > 0) {
      const stats = capacityStats[0];
      console.log("\n📊 Capacity Statistics:");
      console.log(
        `  - Total capacity: ${stats.totalCapacity.toLocaleString()} seats`
      );
      console.log(
        `  - Average capacity: ${Math.round(
          stats.avgCapacity
        ).toLocaleString()} seats`
      );
      console.log(
        `  - Largest venue: ${stats.maxCapacity.toLocaleString()} seats`
      );
      console.log(
        `  - Smallest venue: ${stats.minCapacity.toLocaleString()} seats`
      );
    }

    // Show venues by country
    const venuesByCountry = await Venue.aggregate([
      {
        $group: {
          _id: "$country",
          count: { $sum: 1 },
          totalCapacity: { $sum: "$capacity" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    console.log("\n🌍 Venues by Country:");
    venuesByCountry.forEach((country) => {
      console.log(
        `  - ${country._id}: ${
          country.count
        } venues, ${country.totalCapacity.toLocaleString()} total seats`
      );
    });
  } catch (error) {
    console.error("❌ Error importing venues:", error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run the import
importPremierLeagueVenues();
