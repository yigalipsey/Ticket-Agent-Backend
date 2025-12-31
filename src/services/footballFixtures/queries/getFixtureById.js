import FootballEvent from "../../../models/FootballEvent.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";

/**
 * Get full fixture details by ID with populated teams, venue, and league
 */
export const getFixtureById = async (fixtureId) => {
    try {
        logWithCheckpoint(
            "info",
            "Fetching fixture by ID",
            "FIXTURE_BY_ID_001",
            { fixtureId }
        );

        const fixture = await FootballEvent.findById(fixtureId)
            .populate("homeTeam")
            .populate("awayTeam")
            .populate("venue")
            .populate("league")
            .lean();

        if (!fixture) {
            logWithCheckpoint(
                "warn",
                "Fixture not found by ID",
                "FIXTURE_BY_ID_002",
                { fixtureId }
            );
            return null;
        }

        logWithCheckpoint(
            "info",
            "Fixture found by ID",
            "FIXTURE_BY_ID_003",
            {
                fixtureId,
                homeTeam: fixture.homeTeam?.name,
                awayTeam: fixture.awayTeam?.name
            }
        );

        return {
            success: true,
            data: fixture
        };
    } catch (error) {
        logError(error, {
            operation: "getFixtureById",
            fixtureId,
        });
        throw error;
    }
};
