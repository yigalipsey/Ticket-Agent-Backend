import FootballEvent from "../../../models/FootballEvent.js";
import { logError } from "../../../utils/logger.js";
import { isValidObjectId } from "../../../utils/validation.js";

/**
 * Fetch fixture with all populated relations
 * Extracted from getOffersByFixtureId for reuse
 * 
 * @param {string} fixtureId - The fixture ID
 * @returns {Promise<Object|null>} Populated fixture or null
 */
export const fetchFixtureWithPopulate = async (fixtureId) => {
    // בדיקת תקינות ObjectId
    if (!isValidObjectId(fixtureId)) {
        console.error("❌ [DEBUG] Invalid ObjectId format:", fixtureId);
        throw new Error(`Invalid fixtureId format: ${fixtureId}`);
    }

    let fixture = await FootballEvent.findById(fixtureId).lean();

    console.log("🔍 [DEBUG] Raw fixture before populate:", {
        fixtureId,
        fixtureFound: !!fixture,
        fixtureIdType: typeof fixtureId,
    });

    if (fixture) {
        // שמירת המשחק המקורי לפני populate (למקרה של שגיאה)
        const originalFixture = { ...fixture };

        try {
            fixture = await FootballEvent.findById(fixtureId)
                .populate("homeTeam", "name slug logo logoUrl")
                .populate("awayTeam", "name slug logo logoUrl")
                .populate({
                    path: "venue",
                    select: "name city_en city_he country_en country_he capacity",
                })
                .populate({
                    path: "league",
                    select: "name nameHe slug country countryHe",
                })
                .lean();

            console.log("🔍 [DEBUG] Fixture after populate:", {
                fixtureFound: !!fixture,
                hasHomeTeam: !!fixture?.homeTeam,
                hasAwayTeam: !!fixture?.awayTeam,
                hasVenue: !!fixture?.venue,
                hasLeague: !!fixture?.league,
            });

            // אם ה-populate החזיר null (לא אמור לקרות), נשתמש במשחק המקורי
            if (!fixture) {
                console.warn(
                    "⚠️ [DEBUG] Populate returned null, using original fixture"
                );
                fixture = originalFixture;
            }

            // Convert venue and league to Hebrew format
            if (fixture && fixture.venue) {
                fixture.venue = {
                    _id: fixture.venue._id,
                    name: fixture.venue.name,
                    city: fixture.venue.city_he || fixture.venue.city_en,
                    country: fixture.venue.country_he || fixture.venue.country_en,
                    capacity: fixture.venue.capacity,
                };
            }

            if (fixture && fixture.league) {
                fixture.league = {
                    _id: fixture.league._id,
                    name: fixture.league.nameHe || fixture.league.name,
                    slug: fixture.league.slug,
                    country: fixture.league.countryHe || fixture.league.country,
                };
            }
        } catch (populateError) {
            console.error("❌ [DEBUG] Error during populate:", populateError);
            logError(populateError, {
                operation: "fetchFixtureWithPopulate",
                fixtureId,
            });
            // אם יש שגיאה ב-populate, נשתמש במשחק המקורי (בלי populate)
            fixture = originalFixture;
        }
    } else {
        console.warn("⚠️ [DEBUG] Fixture not found in DB:", {
            fixtureId,
            fixtureIdType: typeof fixtureId,
        });
    }

    return fixture;
};

/**
 * Select Hebrew name from entity
 * @param {Object} entity - Entity with name fields
 * @returns {string|null} Hebrew name or fallback
 */
const selectHebrewName = (entity) => {
    if (!entity) return null;
    return (
        entity.name_he ||
        entity.nameHe ||
        entity.name ||
        entity.name_en ||
        entity.nameEn ||
        null
    );
};

/**
 * Extract logo URL from entity
 * @param {Object} entity - Entity with logo fields
 * @returns {string|null} Logo URL
 */
const extractLogo = (entity) => {
    if (!entity) return null;
    return entity.logoUrl || entity.logo || entity.imageUrl || null;
};

/**
 * Build response fixture object with Hebrew names and logos
 * Extracted from getOffersByFixtureId for reuse
 * 
 * @param {Object} fixture - Populated fixture from DB
 * @returns {Object|null} Formatted fixture for response
 */
export const buildResponseFixture = (fixture) => {
    if (!fixture) return null;

    return {
        _id: fixture._id,
        date: fixture.date,
        homeTeam: fixture.homeTeam
            ? {
                name: selectHebrewName(fixture.homeTeam),
                logoUrl: extractLogo(fixture.homeTeam),
            }
            : fixture.homeTeamName
                ? {
                    name: fixture.homeTeamName,
                    logoUrl: null,
                }
                : null,
        awayTeam: fixture.awayTeam
            ? {
                name: selectHebrewName(fixture.awayTeam),
                logoUrl: extractLogo(fixture.awayTeam),
            }
            : fixture.awayTeamName
                ? {
                    name: fixture.awayTeamName,
                    logoUrl: null,
                }
                : null,
        // Include homeTeamName and awayTeamName for TBD teams
        homeTeamName: fixture.homeTeamName || null,
        awayTeamName: fixture.awayTeamName || null,
        venue: fixture.venue
            ? {
                name:
                    fixture.venue.name_he ||
                    fixture.venue.name ||
                    fixture.venue.name_en ||
                    null,
                city:
                    fixture.venue.city_he ||
                    fixture.venue.city ||
                    fixture.venue.city_en ||
                    null,
            }
            : null,
        league: fixture.league
            ? {
                name:
                    fixture.league.nameHe ||
                    fixture.league.name_he ||
                    fixture.league.name ||
                    null,
            }
            : null,
    };
};
