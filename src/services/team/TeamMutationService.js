import Team from "../../models/Team.js";
import Venue from "../../models/Venue.js";
import { logWithCheckpoint, logError } from "../../utils/logger.js";

class TeamMutationService {
  // Create new team
  async createTeam(teamData) {
    try {
      logWithCheckpoint("info", "Starting to create new team", "TEAM_014", {
        teamData,
      });

      const team = new Team(teamData);
      const savedTeam = await team.save();

      logWithCheckpoint("info", "Successfully created team", "TEAM_015", {
        id: savedTeam._id,
      });

      return savedTeam;
    } catch (error) {
      logError(error, { operation: "createTeam", teamData });
      throw error;
    }
  }

  // Update team
  async updateTeam(id, updateData) {
    try {
      logWithCheckpoint("info", "Starting to update team", "TEAM_016", {
        id,
        updateData,
      });

      const team = await Team.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      })
        .populate("venueId", "name city capacity")
        .lean();

      if (!team) {
        logWithCheckpoint("warn", "Team not found for update", "TEAM_017", {
          id,
        });
        return null;
      }

      logWithCheckpoint("info", "Successfully updated team", "TEAM_018", {
        id,
      });
      return team;
    } catch (error) {
      logError(error, { operation: "updateTeam", id, updateData });
      throw error;
    }
  }

  // Create or update team from external data
  async upsertTeamFromExternal(externalData, provider = "apiFootball") {
    try {
      logWithCheckpoint(
        "info",
        "Starting team upsert from external data",
        "TEAM_019",
        {
          provider,
          externalId: externalData.id,
        }
      );

      const filter = {};
      filter[`externalIds.${provider}`] = externalData.id;

      const existingTeam = await Team.findOne(filter);

      if (existingTeam) {
        logWithCheckpoint("info", "Updating existing team", "TEAM_020", {
          teamId: existingTeam._id,
        });

        const updateData = {
          name: externalData.name,
          code:
            externalData.code ||
            externalData.name.substring(0, 3).toUpperCase(),
          country: externalData.country || "England",
          logoUrl: externalData.logo,
        };

        const updatedTeam = await Team.findByIdAndUpdate(
          existingTeam._id,
          updateData,
          { new: true, runValidators: true }
        )
          .populate("venueId", "name city capacity")
          .lean();

        logWithCheckpoint(
          "info",
          "Successfully updated team from external",
          "TEAM_021",
          {
            teamId: updatedTeam._id,
          }
        );

        return updatedTeam;
      } else {
        logWithCheckpoint(
          "info",
          "Creating new team from external data",
          "TEAM_022"
        );

        // Find or create venue
        let venue = null;
        if (externalData.venue) {
          venue = await Venue.findOne({ venueId: externalData.venue.id });
          if (!venue) {
            venue = new Venue({
              name: externalData.venue.name,
              city: externalData.venue.city,
              country: externalData.country || "England",
              capacity: 50000, // Default capacity
              venueId: externalData.venue.id,
              externalIds: {
                apiFootball: externalData.venue.id,
              },
            });
            await venue.save();
          }
        }

        const newTeamData = {
          name: externalData.name,
          code:
            externalData.code ||
            externalData.name.substring(0, 3).toUpperCase(),
          country: externalData.country || "England",
          logoUrl: externalData.logo,
          teamId: externalData.id,
          venueId: venue ? venue._id : null,
          externalIds: {
            [provider]: externalData.id,
          },
        };

        const newTeam = await this.createTeam(newTeamData);

        logWithCheckpoint(
          "info",
          "Successfully created team from external",
          "TEAM_023",
          {
            teamId: newTeam._id,
          }
        );

        return newTeam;
      }
    } catch (error) {
      logError(error, {
        operation: "upsertTeamFromExternal",
        provider,
        externalData,
      });
      throw error;
    }
  }
}

export default new TeamMutationService();
