import axios from "axios";
import mongoose from "mongoose";
import dotenv from "dotenv";

// Import models
import League from "../src/models/League.js";
import Team from "../src/models/Team.js";
import Venue from "../src/models/Venue.js";

dotenv.config();

class Ligue1Creator {
  constructor() {
    this.apiKey = process.env.API_FOOTBALL_KEY;
    this.baseUrl = "https://v3.football.api-sports.io";
    this.leagueId = 61; // Ligue 1 ID
    this.season = 2025;
  }

  async connectDB() {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("✅ Connected to MongoDB");
    } catch (error) {
      console.error("❌ MongoDB connection error:", error);
      process.exit(1);
    }
  }

  getHebrewLeagueName() {
    return "ליג 1";
  }

  getHebrewCountryName() {
    return "צרפת";
  }

  getHebrewTeamName(teamName) {
    const translations = {
      "Paris Saint-Germain": "פריז סן-ז'רמן",
      "Olympique de Marseille": "אולימפיק מרסיי",
      "Olympique Lyonnais": "אולימפיק ליון",
      "AS Monaco": "מונקו",
      "Lille OSC": "ליל",
      "RC Lens": "לאנס",
      "OGC Nice": "ניס",
      "Stade Rennais": "רן",
      "Montpellier HSC": "מונפלייה",
      "FC Nantes": "נאנט",
      "Strasbourg": "שטרסבורג",
      "Toulouse FC": "טולוז",
      "Stade de Reims": "ריימס",
      "FC Lorient": "לוריאן",
      "Clermont Foot": "קלרמון",
      "Le Havre AC": "לה האבר",
      "FC Metz": "מץ",
      "Brest": "ברסט",
      "Angers SCO": "אנג'ה",
      "AJ Auxerre": "אוסר"
    };

    return translations[teamName] || teamName;
  }

  getHebrewVenueName(venueName) {
    const translations = {
      "Parc des Princes": "פארק דה פרינס",
      "Stade Velodrome": "סטאד ולודרום",
      "Groupama Stadium": "גרופמה סטדיום",
      "Stade Louis II": "סטאד לואי השני",
      "Stade Pierre-Mauroy": "סטאד פייר-מורואה",
      "Stade Bollaert-Delelis": "סטאד בולארט-דלליס",
      "Allianz Riviera": "אליאנץ ריביירה",
      "Roazhon Park": "רואזון פארק",
      "Stade de la Mosson": "סטאד דה לה מוסון",
      "Stade de la Beaujoire": "סטאד דה לה בוז'ואר",
      "Stade de la Meinau": "סטאד דה לה מינו",
      "Stadium de Toulouse": "סטאדיום דה טולוז",
      "Stade Auguste-Delaune": "סטאד אוגוסט-דלון",
      "Stade du Moustoir": "סטאד דו מוסטואר",
      "Stade Gabriel-Montpied": "סטאד גבריאל-מונפיאן",
      "Stade Oceane": "סטאד אוקיאן",
      "Stade Saint-Symphorien": "סטאד סן-סימפוריאן",
      "Stade Francis-Le Ble": "סטאד פרנסיס-לה בלה",
      "Stade Raymond-Kopa": "סטאד ריימונד-קופה",
      "Stade de l'Abbé-Deschamps": "סטאד דה ל'אבה-דשאן"
    };

    return translations[venueName] || venueName;
  }

  getHebrewCityName(cityName) {
    const translations = {
      Paris: "פריז",
      Marseille: "מרסיי",
      Lyon: "ליון",
      Monaco: "מונקו",
      Lille: "ליל",
      Lens: "לאנס",
      Nice: "ניס",
      Rennes: "רן",
      Montpellier: "מונפלייה",
      Nantes: "נאנט",
      Strasbourg: "שטרסבורג",
      Toulouse: "טולוז",
      Reims: "ריימס",
      Lorient: "לוריאן",
      Clermont: "קלרמון",
      "Le Havre": "לה האבר",
      Metz: "מץ",
      Brest: "ברסט",
      Angers: "אנג'ה",
      Auxerre: "אוסר"
    };

    return translations[cityName] || cityName;
  }

  async createOrUpdateLeague() {
    try {
      const leagueData = {
        leagueId: this.leagueId,
        name: "Ligue 1",
        nameHe: this.getHebrewLeagueName(),
        slug: "ligue-1",
        country: "France",
        countryHe: this.getHebrewCountryName(),
        logoUrl: `https://media.api-sports.io/football/leagues/${this.leagueId}.png`,
        type: "League",
        isPopular: true,
        months: [
          "2025-08",
          "2025-09",
          "2025-10",
          "2025-11",
          "2025-12",
          "2026-01",
          "2026-02",
          "2026-03",
          "2026-04",
          "2026-05",
        ],
        externalIds: {
          apiFootball: this.leagueId,
        },
      };

      const existingLeague = await League.findOne({ leagueId: this.leagueId });

      if (existingLeague) {
        await League.findByIdAndUpdate(existingLeague._id, leagueData);
        console.log(`✅ Updated Ligue 1: ${leagueData.nameHe}`);
        return existingLeague._id;
      } else {
        const newLeague = new League(leagueData);
        await newLeague.save();
        console.log(`✅ Created Ligue 1: ${leagueData.nameHe}`);
        return newLeague._id;
      }
    } catch (error) {
      console.error("❌ Error creating/updating league:", error);
      throw error;
    }
  }

  async fetchTeamsFromAPI() {
    try {
      console.log("🔍 Fetching teams from API...");

      const response = await axios.get(`${this.baseUrl}/teams`, {
        params: {
          league: this.leagueId,
          season: this.season,
        },
        headers: {
          "X-RapidAPI-Key": this.apiKey,
          "X-RapidAPI-Host": "v3.football.api-sports.io",
        },
      });

      if (response.data.results === 0) {
        console.log("⚠️ No teams found for Ligue 1");
        return [];
      }

      console.log(`✅ Found ${response.data.results} teams`);
      return response.data.response;
    } catch (error) {
      console.error("❌ Error fetching teams:", error);
      throw error;
    }
  }

  async createOrUpdateVenue(venueData, teamName) {
    try {
      const venue = {
        name_en: venueData.name,
        name_he: this.getHebrewVenueName(venueData.name),
        city_en: venueData.city,
        city_he: this.getHebrewCityName(venueData.city),
        capacity: venueData.capacity || 0,
        country_en: venueData.country || "Unknown",
        country_he: this.getHebrewCountryName(),
        address_en: venueData.address || "",
        address_he: venueData.address || "",
        image: venueData.image || "",
        venueId: venueData.id,
        externalIds: {
          apiFootball: venueData.id,
        },
      };

      const existingVenue = await Venue.findOne({ venueId: venueData.id });

      if (existingVenue) {
        await Venue.findByIdAndUpdate(existingVenue._id, venue);
        console.log(`✅ Updated venue: ${venue.name_he}`);
        return existingVenue._id;
      } else {
        const newVenue = new Venue(venue);
        await newVenue.save();
        console.log(`✅ Created venue: ${venue.name_he}`);
        return newVenue._id;
      }
    } catch (error) {
      console.error(`❌ Error creating/updating venue for ${teamName}:`, error);
      throw error;
    }
  }

  async createOrUpdateTeam(teamData, leagueId, venueId) {
    try {
      const team = {
        name: this.getHebrewTeamName(teamData.team.name),
        name_en: teamData.team.name,
        name_he: this.getHebrewTeamName(teamData.team.name),
        slug: teamData.team.name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, ""),
        country_en: teamData.team.country,
        country_he: this.getHebrewCountryName(),
        logoUrl: teamData.team.logo,
        teamId: teamData.team.id,
        venueId: venueId,
        leagueIds: [leagueId],
        externalIds: {
          apiFootball: teamData.team.id,
        },
        isPopular: this.isPopularTeam(teamData.team.name),
      };

      const existingTeam = await Team.findOne({ teamId: teamData.team.id });

      if (existingTeam) {
        // Add league to existing team if not already present
        if (!existingTeam.leagueIds.includes(leagueId)) {
          existingTeam.leagueIds.push(leagueId);
          await existingTeam.save();
        }
        console.log(`✅ Updated team: ${team.name_he}`);
        return existingTeam._id;
      } else {
        const newTeam = new Team(team);
        await newTeam.save();
        console.log(`✅ Created team: ${team.name_he}`);
        return newTeam._id;
      }
    } catch (error) {
      console.error(
        `❌ Error creating/updating team ${teamData.team.name}:`,
        error
      );
      throw error;
    }
  }

  isPopularTeam(teamName) {
    const popularTeams = [
      "Paris Saint-Germain",
      "Olympique de Marseille",
      "Olympique Lyonnais",
      "AS Monaco",
      "Lille OSC",
      "RC Lens",
      "OGC Nice",
      "Stade Rennais"
    ];

    return popularTeams.includes(teamName);
  }

  async createLigue1() {
    try {
      await this.connectDB();

        console.log("🚀 Starting Ligue 1 creation...");

      // Create/update league
      const leagueId = await this.createOrUpdateLeague();

      // Fetch teams from API
      const teamsData = await this.fetchTeamsFromAPI();

      if (teamsData.length === 0) {
        console.log("⚠️ No teams to process");
        return;
      }

      console.log(`📊 Processing ${teamsData.length} teams...`);

      for (const teamData of teamsData) {
        try {
          // Create/update venue
          let venueId = null;
          if (teamData.venue) {
            venueId = await this.createOrUpdateVenue(
              teamData.venue,
              teamData.team.name
            );
          }

          // Create/update team
          await this.createOrUpdateTeam(teamData, leagueId, venueId);
        } catch (error) {
          console.error(
            `❌ Error processing team ${teamData.team.name}:`,
            error
          );
          continue;
        }
      }

        console.log("🎉 Ligue 1 creation completed successfully!");
    } catch (error) {
      console.error("❌ Error in createLigue1:", error);
    } finally {
      await mongoose.disconnect();
      console.log("👋 Disconnected from MongoDB");
    }
  }
}

// Run the script
const creator = new Ligue1Creator();
creator.createLigue1();
