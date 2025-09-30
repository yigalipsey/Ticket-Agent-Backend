import League from "../../models/League.js";
import { logWithCheckpoint, logError } from "../../utils/logger.js";

class LeagueMutationService {
  // Create new league
  async createLeague(leagueData) {
    try {
      logWithCheckpoint("info", "Starting to create new league", "LEAGUE_015", {
        leagueData,
      });

      const league = new League(leagueData);
      const savedLeague = await league.save();

      logWithCheckpoint("info", "Successfully created league", "LEAGUE_016", {
        id: savedLeague._id,
      });

      return savedLeague;
    } catch (error) {
      logError(error, { operation: "createLeague", leagueData });
      throw error;
    }
  }

  // Update league
  async updateLeague(id, updateData) {
    try {
      logWithCheckpoint("info", "Starting to update league", "LEAGUE_017", {
        id,
        updateData,
      });

      const league = await League.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      }).lean();

      if (!league) {
        logWithCheckpoint("warn", "League not found for update", "LEAGUE_018", {
          id,
        });
        return null;
      }

      logWithCheckpoint("info", "Successfully updated league", "LEAGUE_019", {
        id,
      });
      return league;
    } catch (error) {
      logError(error, { operation: "updateLeague", id, updateData });
      throw error;
    }
  }

  // Create or update league from external data
  async upsertLeagueFromExternal(externalData, provider = "apiFootball") {
    try {
      logWithCheckpoint(
        "info",
        "Starting league upsert from external data",
        "LEAGUE_020",
        {
          provider,
          externalId: externalData.id,
        }
      );

      const filter = {};
      filter[`externalIds.${provider}`] = externalData.id;

      const existingLeague = await League.findOne(filter);

      if (existingLeague) {
        logWithCheckpoint("info", "Updating existing league", "LEAGUE_021", {
          leagueId: existingLeague._id,
        });

        const updateData = {
          name: externalData.name,
          country: externalData.country,
          logoUrl: externalData.logo,
          type: externalData.type || "League",
        };

        const updatedLeague = await League.findByIdAndUpdate(
          existingLeague._id,
          updateData,
          { new: true, runValidators: true }
        ).lean();

        logWithCheckpoint(
          "info",
          "Successfully updated league from external",
          "LEAGUE_022",
          {
            leagueId: updatedLeague._id,
          }
        );

        return updatedLeague;
      } else {
        logWithCheckpoint(
          "info",
          "Creating new league from external data",
          "LEAGUE_023"
        );

        const newLeagueData = {
          leagueId: externalData.id,
          name: externalData.name,
          country: externalData.country,
          logoUrl: externalData.logo,
          type: externalData.type || "League",
          externalIds: {
            [provider]: externalData.id,
          },
        };

        const newLeague = await this.createLeague(newLeagueData);

        logWithCheckpoint(
          "info",
          "Successfully created league from external",
          "LEAGUE_024",
          {
            leagueId: newLeague._id,
          }
        );

        return newLeague;
      }
    } catch (error) {
      logError(error, {
        operation: "upsertLeagueFromExternal",
        provider,
        externalData,
      });
      throw error;
    }
  }
}

export default new LeagueMutationService();
