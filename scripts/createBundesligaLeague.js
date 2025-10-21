import dotenv from "dotenv";
import axios from "axios";
import mongoose from "mongoose";
import databaseConnection from "../src/config/database.js";
import League from "../src/models/League.js";
import Team from "../src/models/Team.js";
import Venue from "../src/models/Venue.js";

// Load environment variables
dotenv.config();

class BundesligaLeagueCreator {
  constructor() {
    this.apiFootballKey = process.env.API_FOOTBALL_KEY;
    this.apiFootballBaseUrl =
      process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";
    this.mongoUri = process.env.MONGODB_URI;

    if (!this.apiFootballKey) {
      throw new Error("API_FOOTBALL_KEY is required in environment variables");
    }

    if (!this.mongoUri) {
      throw new Error("MONGODB_URI is required in environment variables");
    }

    this.apiClient = axios.create({
      baseURL: this.apiFootballBaseUrl,
      headers: {
        "X-RapidAPI-Key": this.apiFootballKey,
        "X-RapidAPI-Host": "v3.football.api-sports.io",
      },
      timeout: 30000,
    });

    // Bundesliga league ID in API Football
    this.bundesligaId = 78;
    this.season = 2025; // Season 2025/2026

    // Stats
    this.stats = {
      league: { created: 0, updated: 0 },
      teams: { created: 0, updated: 0, skipped: 0 },
      venues: { created: 0, updated: 0, skipped: 0 },
      errors: [],
    };
  }

  // Connect to MongoDB
  async connectToDatabase() {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 1] Connecting to MongoDB...");
      console.log("========================================\n");

      await databaseConnection.connect(this.mongoUri);

      if (!databaseConnection.isDatabaseConnected()) {
        throw new Error("Failed to connect to MongoDB");
      }

      console.log("✅ Connected to MongoDB successfully\n");
    } catch (error) {
      console.error("[ERROR] Database connection failed:", error.message);
      throw error;
    }
  }

  // Create slug from name
  createSlug(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim("-");
  }

  // Create or update league
  async createOrUpdateLeague(leagueData) {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 2] Creating/Updating Bundesliga League...");
      console.log("========================================\n");

      const leagueInfo = {
        leagueId: leagueData.league.id,
        name: leagueData.league.name,
        nameHe: "בונדסליגה",
        slug: this.createSlug(leagueData.league.name),
        country: leagueData.country.name,
        countryHe: "גרמניה",
        logoUrl: leagueData.league.logo,
        type: "League",
        isPopular: true, // Bundesliga is popular
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
          apiFootball: leagueData.league.id,
        },
      };

      // Check if league already exists
      const existingLeague = await League.findOne({
        "externalIds.apiFootball": leagueData.league.id,
      });

      if (existingLeague) {
        await League.updateOne(
          { _id: existingLeague._id },
          { $set: leagueInfo }
        );
        this.stats.league.updated++;
        console.log(
          `🔄 Updated league: ${leagueInfo.name} (${leagueInfo.nameHe})\n`
        );
        return existingLeague._id;
      } else {
        const newLeague = new League(leagueInfo);
        await newLeague.save();
        this.stats.league.created++;
        console.log(
          `✅ Created league: ${leagueInfo.name} (${leagueInfo.nameHe})\n`
        );
        return newLeague._id;
      }
    } catch (error) {
      console.error("[ERROR] Failed to create/update league:", error.message);
      this.stats.errors.push({
        type: "league",
        reason: error.message,
        data: leagueData,
      });
      throw error;
    }
  }

  // Get Hebrew venue name
  getHebrewVenueName(venueName) {
    const venueTranslations = {
      "Fußball Arena München": "אצטדיון הכדורגל מינכן",
      "Europa-Park Stadion": "אצטדיון אירופה פארק",
      "Volkswagen Arena": "אצטדיון פולקסווגן",
      "wohninvest WESERSTADION": "אצטדיון ווזר",
      "BORUSSIA-PARK": "אצטדיון בורוסיה פארק",
      "MEWA ARENA": "אצטדיון מווה",
      "BVB Stadion Dortmund": "אצטדיון BVB דורטמונד",
      "PreZero Arena": "אצטדיון פרה זירו",
      BayArena: "אצטדיון באי",
      "Frankfurt Arena": "אצטדיון פרנקפורט",
      "WWK Arena": "אצטדיון WWK",
      "Stuttgart Arena": "אצטדיון שטוטגרט",
      "Leipzig Stadium": "אצטדיון לייפציג",
      Volksparkstadion: "אצטדיון פולקספארק",
      "Voith-Arena": "אצטדיון וויט",
      "Stadion An der Alten Försterei": "אצטדיון היער הישן",
      "Millerntor-Stadion": "אצטדיון מילרנטור",
      "Cologne Stadium": "אצטדיון קלן",
    };

    return venueTranslations[venueName] || venueName;
  }

  // Get Hebrew team name
  getHebrewTeamName(teamName) {
    const teamTranslations = {
      "Bayern München": "באיירן מינכן",
      "SC Freiburg": "פרייבורג",
      "VfL Wolfsburg": "וולפסבורג",
      "Werder Bremen": "ורדר ברמן",
      "Borussia Mönchengladbach": "בורוסיה מנשנגלדבך",
      "FSV Mainz 05": "מיינץ 05",
      "Borussia Dortmund": "בורוסיה דורטמונד",
      "1899 Hoffenheim": "הופנהיים 1899",
      "Bayer Leverkusen": "באייר לברקוזן",
      "Eintracht Frankfurt": "איינטרכט פרנקפורט",
      "FC Augsburg": "אאוגסבורג",
      "VfB Stuttgart": "שטוטגרט",
      "RB Leipzig": "RB לייפציג",
      "Hamburger SV": "המבורגר SV",
      "1. FC Heidenheim": "היידנהיים",
      "Union Berlin": "אוניון ברלין",
      "FC St. Pauli": "סנט פאולי",
      "1.FC Köln": "קלן",
    };

    return teamTranslations[teamName] || teamName;
  }

  // Get Hebrew city name
  getHebrewCityName(cityName) {
    const cityTranslations = {
      Munich: "מינכן",
      Freiburg: "פרייבורג",
      Wolfsburg: "וולפסבורג",
      Bremen: "ברמן",
      Mönchengladbach: "מנשנגלדבך",
      Mainz: "מיינץ",
      Dortmund: "דורטמונד",
      Sinsheim: "זינסהיים",
      Leverkusen: "לברקוזן",
      Frankfurt: "פרנקפורט",
      Augsburg: "אאוגסבורג",
      Stuttgart: "שטוטגרט",
      Leipzig: "לייפציג",
      Hamburg: "המבורג",
      Heidenheim: "היידנהיים",
      Berlin: "ברלין",
      Cologne: "קלן",
    };

    return cityTranslations[cityName] || cityName;
  }

  // Create or update venue
  async createOrUpdateVenue(venueData, teamName) {
    try {
      if (!venueData || !venueData.id) {
        console.log(`⚠️ No venue data for team: ${teamName}`);
        this.stats.venues.skipped++;
        return null;
      }

      const venueInfo = {
        venueId: venueData.id,
        name_en: venueData.name,
        name_he: this.getHebrewVenueName(venueData.name),
        city_en: venueData.city || "Unknown",
        city_he: this.getHebrewCityName(venueData.city || "Unknown"),
        capacity: venueData.capacity || null,
        country_en: "Germany",
        country_he: "גרמניה",
        address_en: venueData.address || null,
        address_he: venueData.address || null,
        image: venueData.image || null,
        externalIds: {
          apiFootball: venueData.id,
        },
      };

      // Check if venue already exists
      const existingVenue = await Venue.findOne({
        "externalIds.apiFootball": venueData.id,
      });

      if (existingVenue) {
        await Venue.updateOne({ _id: existingVenue._id }, { $set: venueInfo });
        this.stats.venues.updated++;
        console.log(`   🔄 Updated venue: ${venueInfo.name_en}`);
        return existingVenue._id;
      } else {
        const newVenue = new Venue(venueInfo);
        await newVenue.save();
        this.stats.venues.created++;
        console.log(`   ✅ Created venue: ${venueInfo.name_en}`);
        return newVenue._id;
      }
    } catch (error) {
      console.error(
        `[ERROR] Failed to create/update venue for ${teamName}:`,
        error.message
      );
      this.stats.errors.push({
        type: "venue",
        reason: error.message,
        teamName,
        data: venueData,
      });
      return null;
    }
  }

  // Create or update team
  async createOrUpdateTeam(teamData, leagueId, venueId) {
    try {
      const teamInfo = {
        name: this.getHebrewTeamName(teamData.name),
        name_en: teamData.name,
        code: teamData.code || teamData.name.substring(0, 3).toUpperCase(),
        slug: this.createSlug(teamData.name),
        country_en: "Germany",
        country_he: "גרמניה",
        logoUrl: teamData.logo,
        teamId: teamData.id,
        venueId: venueId,
        leagueIds: [leagueId],
        externalIds: {
          apiFootball: teamData.id,
        },
        isPopular: this.isPopularTeam(teamData.name),
      };

      // Check if team already exists
      const existingTeam = await Team.findOne({
        "externalIds.apiFootball": teamData.id,
      });

      if (existingTeam) {
        // Update existing team and add league if not already present
        const updateData = { ...teamInfo };
        if (!existingTeam.leagueIds.includes(leagueId)) {
          updateData.$addToSet = { leagueIds: leagueId };
        }

        await Team.updateOne({ _id: existingTeam._id }, { $set: updateData });
        this.stats.teams.updated++;
        console.log(`🔄 Updated team: ${teamInfo.name}`);
        return existingTeam._id;
      } else {
        const newTeam = new Team(teamInfo);
        await newTeam.save();
        this.stats.teams.created++;
        console.log(`✅ Created team: ${teamInfo.name}`);
        return newTeam._id;
      }
    } catch (error) {
      console.error(
        `[ERROR] Failed to create/update team ${teamData.name}:`,
        error.message
      );
      this.stats.errors.push({
        type: "team",
        reason: error.message,
        data: teamData,
      });
      return null;
    }
  }

  // Check if team is popular (big clubs)
  isPopularTeam(teamName) {
    const popularTeams = [
      "Bayern Munich",
      "Borussia Dortmund",
      "RB Leipzig",
      "Bayer Leverkusen",
      "Eintracht Frankfurt",
      "Borussia Mönchengladbach",
      "VfL Wolfsburg",
      "VfB Stuttgart",
      "Hertha BSC",
      "FC Schalke 04",
      "Hamburger SV",
      "Werder Bremen",
      "1. FC Köln",
      "1. FC Union Berlin",
      "SC Freiburg",
      "TSG Hoffenheim",
      "FC Augsburg",
      "1. FSV Mainz 05",
      "Arminia Bielefeld",
      "VfL Bochum",
    ];

    return popularTeams.some(
      (popular) =>
        teamName.toLowerCase().includes(popular.toLowerCase()) ||
        popular.toLowerCase().includes(teamName.toLowerCase())
    );
  }

  // Fetch teams from API
  async fetchTeams() {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 3] Fetching teams from API...");
      console.log(`League ID: ${this.bundesligaId}`);
      console.log(`Season: ${this.season}/${this.season + 1}`);
      console.log("========================================\n");

      const response = await this.apiClient.get("/teams", {
        params: {
          league: this.bundesligaId,
          season: this.season,
        },
      });

      if (response.data && response.data.response) {
        const teams = response.data.response;
        console.log(`✅ Found ${teams.length} teams\n`);
        return teams;
      } else {
        console.log("⚠️ No teams found\n");
        return [];
      }
    } catch (error) {
      console.error("[ERROR] Failed to fetch teams:", error.message);
      if (error.response) {
        console.error("API Error Response:", error.response.data);
      }
      throw error;
    }
  }

  // Create all teams and venues
  async createTeamsAndVenues(teams, leagueId) {
    try {
      console.log("========================================");
      console.log("[CHECKPOINT 4] Creating teams and venues...");
      console.log("========================================\n");

      let processedCount = 0;
      const totalTeams = teams.length;

      for (const teamData of teams) {
        processedCount++;
        const team = teamData.team;
        const venue = teamData.venue;

        console.log(
          `\n[${processedCount}/${totalTeams}] Processing: ${team.name}`
        );

        // Create or update venue first
        const venueId = await this.createOrUpdateVenue(venue, team.name);

        if (!venueId) {
          console.log(`   ⏭️ Skipped team due to venue issues: ${team.name}`);
          this.stats.teams.skipped++;
          continue;
        }

        // Create or update team
        await this.createOrUpdateTeam(team, leagueId, venueId);

        // Display progress every 5 teams
        if (processedCount % 5 === 0 || processedCount === totalTeams) {
          const percentage = ((processedCount / totalTeams) * 100).toFixed(1);
          console.log(
            `\n📊 [${processedCount}/${totalTeams}] Progress: ${percentage}% | ✅ Teams: ${this.stats.teams.created} | 🔄 Teams: ${this.stats.teams.updated} | ⏭️ Teams: ${this.stats.teams.skipped}`
          );
        }
      }

      console.log("\n✅ All teams and venues processed\n");
    } catch (error) {
      console.error(
        "[ERROR] Failed to create teams and venues:",
        error.message
      );
      throw error;
    }
  }

  // Display summary
  displaySummary() {
    console.log("========================================");
    console.log("[CHECKPOINT 5] Summary");
    console.log("========================================");
    console.log(`League: Bundesliga (${this.bundesligaId})`);
    console.log(`Season: ${this.season}/${this.season + 1}`);
    console.log(`✅ League created: ${this.stats.league.created}`);
    console.log(`🔄 League updated: ${this.stats.league.updated}`);
    console.log(`✅ Teams created: ${this.stats.teams.created}`);
    console.log(`🔄 Teams updated: ${this.stats.teams.updated}`);
    console.log(`⏭️ Teams skipped: ${this.stats.teams.skipped}`);
    console.log(`✅ Venues created: ${this.stats.venues.created}`);
    console.log(`🔄 Venues updated: ${this.stats.venues.updated}`);
    console.log(`⏭️ Venues skipped: ${this.stats.venues.skipped}`);
    console.log(`❌ Errors: ${this.stats.errors.length}`);
    console.log("========================================\n");

    if (this.stats.errors.length > 0) {
      console.log("========================================");
      console.log("Error Details:");
      console.log("========================================");

      // Group errors by type
      const errorsByType = {};
      this.stats.errors.forEach((error) => {
        const type = error.type;
        if (!errorsByType[type]) {
          errorsByType[type] = [];
        }
        errorsByType[type].push(error);
      });

      Object.keys(errorsByType).forEach((type) => {
        console.log(`\n[${type}] - ${errorsByType[type].length} errors`);
        errorsByType[type].slice(0, 3).forEach((error, index) => {
          console.log(`  ${index + 1}. ${error.reason}`);
          if (error.teamName) console.log(`     Team: ${error.teamName}`);
        });
        if (errorsByType[type].length > 3) {
          console.log(`  ... and ${errorsByType[type].length - 3} more`);
        }
      });
      console.log("\n========================================\n");
    }
  }

  // Main function
  async run() {
    try {
      console.log("\n🇩🇪 BUNDESLIGA LEAGUE CREATION - SEASON 2025/2026 🇩🇪\n");

      // Connect to database
      await this.connectToDatabase();

      // Create league first
      const leagueData = {
        league: {
          id: this.bundesligaId,
          name: "Bundesliga",
          logo: "https://media.api-sports.io/football/leagues/78.png",
        },
        country: {
          name: "Germany",
        },
      };

      const leagueId = await this.createOrUpdateLeague(leagueData);

      // Fetch and create teams
      const teams = await this.fetchTeams();

      if (teams.length === 0) {
        console.log("No teams to create.");
        return;
      }

      // Create teams and venues
      await this.createTeamsAndVenues(teams, leagueId);

      // Display summary
      this.displaySummary();

      console.log("✅ Process completed successfully!\n");
    } catch (error) {
      console.error("\n❌ Process failed:", error.message);
      throw error;
    } finally {
      // Disconnect from database
      await databaseConnection.disconnect();
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const creator = new BundesligaLeagueCreator();

  (async () => {
    try {
      await creator.run();
      process.exit(0);
    } catch (error) {
      console.error("❌ Process failed:", error.message);
      process.exit(1);
    }
  })();
}

export default BundesligaLeagueCreator;
