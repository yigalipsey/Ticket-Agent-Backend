import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Import Venue model
import Venue from "../src/models/Venue.js";

// La Liga venues data from API response
const laLigaVenues = [
  {
    name: "Estadi Olímpic Lluís Companys",
    address: "Carrer de l'Estadi",
    city: "Barcelona",
    country: "Spain",
    capacity: 55926,
    venueId: 19939,
    image: "https://media.api-sports.io/football/venues/19939.png",
    externalIds: { apiFootball: 19939 },
  },
  {
    name: "Estádio Cívitas Metropolitano",
    address: "Rosas",
    city: "Madrid",
    country: "Spain",
    capacity: 70460,
    venueId: 19217,
    image: "https://media.api-sports.io/football/venues/19217.png",
    externalIds: { apiFootball: 19217 },
  },
  {
    name: "San Mamés Barria",
    address: "Rafael Moreno Pitxitxi Kalea",
    city: "Bilbao",
    country: "Spain",
    capacity: 53289,
    venueId: 1460,
    image: "https://media.api-sports.io/football/venues/1460.png",
    externalIds: { apiFootball: 1460 },
  },
  {
    name: "Estadio de Mestalla",
    address: "Avenida de Suecia",
    city: "Valencia",
    country: "Spain",
    capacity: 55000,
    venueId: 1497,
    image: "https://media.api-sports.io/football/venues/1497.png",
    externalIds: { apiFootball: 1497 },
  },
  {
    name: "Estadio de la Cerámica",
    address: "Plaza Labrador",
    city: "Villarreal",
    country: "Spain",
    capacity: 24500,
    venueId: 1498,
    image: "https://media.api-sports.io/football/venues/1498.png",
    externalIds: { apiFootball: 1498 },
  },
  {
    name: "Estadio Ramón Sánchez Pizjuán",
    address: "Avenida de Eduardo Dato",
    city: "Sevilla",
    country: "Spain",
    capacity: 48649,
    venueId: 1494,
    image: "https://media.api-sports.io/football/venues/1494.png",
    externalIds: { apiFootball: 1494 },
  },
  {
    name: "Abanca-Balaídos",
    address: "Avenida de Balaídos",
    city: "Vigo",
    country: "Spain",
    capacity: 31800,
    venueId: 1467,
    image: "https://media.api-sports.io/football/venues/1467.png",
    externalIds: { apiFootball: 1467 },
  },
  {
    name: "Estadio Ciudad de Valencia",
    address: "Calle San Vicente de Paúl 44",
    city: "Valencia",
    country: "Spain",
    capacity: 25534,
    venueId: 1482,
    image: "https://media.api-sports.io/football/venues/1482.png",
    externalIds: { apiFootball: 1482 },
  },
  {
    name: "Stage Front Stadium",
    address: "Avenida Baix Llobregat 100",
    city: "Cornella de Llobregat",
    country: "Spain",
    capacity: 40423,
    venueId: 20421,
    image: "https://media.api-sports.io/football/venues/20421.png",
    externalIds: { apiFootball: 20421 },
  },
  {
    name: "Estadio Santiago Bernabéu",
    address: "Avenida de Concha Espina 1, Chamartín",
    city: "Madrid",
    country: "Spain",
    capacity: 85454,
    venueId: 1456,
    image: "https://media.api-sports.io/football/venues/1456.png",
    externalIds: { apiFootball: 1456 },
  },
  {
    name: "Estadio de Mendizorroza",
    address: "Paseo de Cervantes",
    city: "Vitoria-Gasteiz",
    country: "Spain",
    capacity: 19840,
    venueId: 1470,
    image: "https://media.api-sports.io/football/venues/1470.png",
    externalIds: { apiFootball: 1470 },
  },
  {
    name: "Estadio Benito Villamarín",
    address: "Avenida de Heliópolis",
    city: "Sevilla",
    country: "Spain",
    capacity: 60721,
    venueId: 1489,
    image: "https://media.api-sports.io/football/venues/1489.png",
    externalIds: { apiFootball: 1489 },
  },
  {
    name: "Estadio Coliseum",
    address: "Avenida de Teresa de Calcuta",
    city: "Getafe",
    country: "Spain",
    capacity: 17393,
    venueId: 20422,
    image: "https://media.api-sports.io/football/venues/20422.png",
    externalIds: { apiFootball: 20422 },
  },
  {
    name: "Estadi Municipal de Montilivi",
    address: "Avenida Montlivi 141",
    city: "Girona",
    country: "Spain",
    capacity: 14500,
    venueId: 1478,
    image: "https://media.api-sports.io/football/venues/1478.png",
    externalIds: { apiFootball: 1478 },
  },
  {
    name: "Reale Arena",
    address: "Paseo de Anoeta 1",
    city: "Donostia-San Sebastián",
    country: "Spain",
    capacity: 40000,
    venueId: 1491,
    image: "https://media.api-sports.io/football/venues/1491.png",
    externalIds: { apiFootball: 1491 },
  },
  {
    name: "Estadio Nuevo Carlos Tartiere",
    address: "C. Isidro Lángara",
    city: "Oviedo",
    country: "Spain",
    capacity: 30500,
    venueId: 1490,
    image: "https://media.api-sports.io/football/venues/1490.png",
    externalIds: { apiFootball: 1490 },
  },
  {
    name: "Estadio El Sadar",
    address: "Carretera El Sadar",
    city: "Iruñea",
    country: "Spain",
    capacity: 23576,
    venueId: 1486,
    image: "https://media.api-sports.io/football/venues/1486.png",
    externalIds: { apiFootball: 1486 },
  },
  {
    name: "Estadio de Vallecas",
    address: "Calle Payaso Fofó",
    city: "Madrid",
    country: "Spain",
    capacity: 15500,
    venueId: 1488,
    image: "https://media.api-sports.io/football/venues/1488.png",
    externalIds: { apiFootball: 1488 },
  },
  {
    name: "Estadio Manuel Martínez Valero",
    address: "Avenida Manuel Martínez Valero 3",
    city: "Elche",
    country: "Spain",
    capacity: 36017,
    venueId: 1473,
    image: "https://media.api-sports.io/football/venues/1473.png",
    externalIds: { apiFootball: 1473 },
  },
  {
    name: "Estadi Mallorca Son Moix",
    address: "Camí dels Reis",
    city: "Palma de Mallorca",
    country: "Spain",
    capacity: 23142,
    venueId: 19940,
    image: "https://media.api-sports.io/football/venues/19940.png",
    externalIds: { apiFootball: 19940 },
  },
];

async function importLaLigaVenues() {
  try {
    console.log("🔄 Connecting to MongoDB...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    console.log("🔄 Importing La Liga venues...");

    const importedVenues = [];

    for (const venueData of laLigaVenues) {
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
importLaLigaVenues();
