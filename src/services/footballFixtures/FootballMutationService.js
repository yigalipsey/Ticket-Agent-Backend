import FootballEvent from "../../models/FootballEvent.js";
import { logWithCheckpoint, logError } from "../../utils/logger.js";

class FootballMutationService {
  // Create new football event
  async createFootballEvent(footballEventData) {
    try {
      logWithCheckpoint(
        "info",
        "Starting to create new football event",
        "FOOTBALL_013",
        {
          footballEventData,
        }
      );

      const footballEvent = new FootballEvent(footballEventData);
      const savedFootballEvent = await footballEvent.save();

      logWithCheckpoint(
        "info",
        "Successfully created football event",
        "FOOTBALL_014",
        {
          id: savedFootballEvent._id,
        }
      );

      return savedFootballEvent;
    } catch (error) {
      logError(error, { operation: "createFootballEvent", footballEventData });
      throw error;
    }
  }

  // Update football event
  async updateFootballEvent(id, updateData) {
    try {
      logWithCheckpoint(
        "info",
        "Starting to update football event",
        "FOOTBALL_015",
        {
          id,
          updateData,
        }
      );

      const footballEvent = await FootballEvent.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true,
          runValidators: true,
        }
      )
        .populate("league", "name nameHe country")
        .populate("homeTeam", "name code")
        .populate("awayTeam", "name code")
        .populate("venue", "name city capacity")
        .lean();

      if (!footballEvent) {
        logWithCheckpoint(
          "warn",
          "Football event not found for update",
          "FOOTBALL_016",
          {
            id,
          }
        );
        return null;
      }

      logWithCheckpoint(
        "info",
        "Successfully updated football event",
        "FOOTBALL_017",
        {
          id,
        }
      );
      
      // Set Hebrew name as default name for league
      if (footballEvent && footballEvent.league && footballEvent.league.nameHe) {
        footballEvent.league.name = footballEvent.league.nameHe;
      }
      
      return footballEvent;
    } catch (error) {
      logError(error, { operation: "updateFootballEvent", id, updateData });
      throw error;
    }
  }

  // Create or update football event from external data
  async upsertFootballEventFromExternal(
    externalData,
    provider = "apiFootball"
  ) {
    try {
      logWithCheckpoint(
        "info",
        "Starting football event upsert from external data",
        "FOOTBALL_018",
        {
          provider,
          externalId: externalData.fixture.id,
        }
      );

      const filter = {};
      filter[`externalIds.${provider}`] = externalData.fixture.id;

      const existingFootballEvent = await FootballEvent.findOne(filter);

      if (existingFootballEvent) {
        logWithCheckpoint(
          "info",
          "Updating existing football event",
          "FOOTBALL_019",
          {
            footballEventId: existingFootballEvent._id,
          }
        );

        const updateData = {
          date: new Date(externalData.fixture.date),
          status: externalData.fixture.status.short,
          round: externalData.league.round,
          tags: [
            externalData.league.name,
            externalData.league.season.toString(),
          ],
        };

        const updatedFootballEvent = await FootballEvent.findByIdAndUpdate(
          existingFootballEvent._id,
          updateData,
          { new: true, runValidators: true }
        )
          .populate("league", "name nameHe country")
          .populate("homeTeam", "name code")
          .populate("awayTeam", "name code")
          .populate("venue", "name city capacity")
          .lean();

        logWithCheckpoint(
          "info",
          "Successfully updated football event from external",
          "FOOTBALL_020",
          {
            footballEventId: updatedFootballEvent._id,
          }
        );

        // Set Hebrew name as default name for league
        if (updatedFootballEvent && updatedFootballEvent.league && updatedFootballEvent.league.nameHe) {
          updatedFootballEvent.league.name = updatedFootballEvent.league.nameHe;
        }

        return updatedFootballEvent;
      } else {
        logWithCheckpoint(
          "info",
          "Creating new football event from external data",
          "FOOTBALL_021"
        );

        const newFootballEventData = {
          fixtureId: externalData.fixture.id,
          date: new Date(externalData.fixture.date),
          status: externalData.fixture.status.short,
          league: externalData.league._id,
          homeTeam: externalData.teams.home._id,
          awayTeam: externalData.teams.away._id,
          venue: externalData.venue._id,
          round: externalData.league.round,
          roundNumber: 1,
          tags: [
            externalData.league.name,
            externalData.league.season.toString(),
          ],
          externalIds: {
            [provider]: externalData.fixture.id,
          },
        };

        const newFootballEvent = await this.createFootballEvent(
          newFootballEventData
        );

        logWithCheckpoint(
          "info",
          "Successfully created football event from external",
          "FOOTBALL_022",
          {
            footballEventId: newFootballEvent._id,
          }
        );

        return newFootballEvent;
      }
    } catch (error) {
      logError(error, {
        operation: "upsertFootballEventFromExternal",
        provider,
        externalData,
      });
      throw error;
    }
  }
}

export default new FootballMutationService();
