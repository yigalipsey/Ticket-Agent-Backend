import Offer from "../../../models/Offer.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import {
  attachLegacyOwnerFields,
  formatOfferForResponse,
} from "../utils/offerMapper.js";

class AgentOfferService {
  /**
   * Fetch all agent owned offers for a given fixture directly from the DB.
   * Agents do not have external APIs, so this is always a single DB query.
   */
  static async getOffersByFixture(fixtureId) {
    try {
      logWithCheckpoint(
        "info",
        "Loading agent offers from database",
        "AGENT_OFFER_001",
        { fixtureId }
      );

      const offers = await Offer.find({
        fixtureId,
        ownerType: "Agent",
      })
        .populate({
          path: "ownerId",
          select: "name whatsapp isActive imageUrl agentType companyName externalRating",
        })
        .lean();

      logWithCheckpoint(
        "info",
        "Agent offers fetched successfully",
        "AGENT_OFFER_002",
        {
          fixtureId,
          offersCount: offers.length,
        }
      );

      return offers.map(attachLegacyOwnerFields);
    } catch (error) {
      logError(error, {
        operation: "AgentOfferService.getOffersByFixture",
        fixtureId,
      });
      throw error;
    }
  }

  /**
   * Fetch all offers for a specific agent (across all fixtures) with pagination.
   */
  static async getOffersByAgent(agentId, query = {}) {
    try {
      logWithCheckpoint(
        "info",
        "Starting to fetch offers by agent",
        "AGENT_OFFER_010",
        {
          agentId,
          query,
        }
      );

      const {
        page = 1,
        limit = 20,
        isAvailable,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = query;

      const numericPage = Number.isNaN(Number(page)) ? 1 : parseInt(page, 10);
      const numericLimit = Number.isNaN(Number(limit))
        ? 20
        : parseInt(limit, 10);

      const filter = {
        ownerType: "Agent",
        ownerId: agentId,
      };

      if (typeof isAvailable !== "undefined") {
        const normalizedIsAvailable =
          typeof isAvailable === "boolean"
            ? isAvailable
            : String(isAvailable).toLowerCase() === "true";
        filter.isAvailable = normalizedIsAvailable;
      }

      const sortDirection = sortOrder === "asc" ? 1 : -1;
      const sort = {
        [sortBy]: sortDirection,
      };

      const skip = (numericPage - 1) * numericLimit;

      const [offers, total] = await Promise.all([
        Offer.find(filter)
          .populate({
            path: "ownerId",
            select: "name whatsapp isActive imageUrl agentType companyName",
          })
          .populate({
            path: "fixtureId",
            select: "date homeTeam awayTeam league venue",
            populate: [
              { path: "homeTeam", select: "name logoUrl" },
              { path: "awayTeam", select: "name logoUrl" },
              { path: "league", select: "name nameHe" },
              { path: "venue", select: "name city" },
            ],
          })
          .sort(sort)
          .skip(skip)
          .limit(numericLimit)
          .lean(),
        Offer.countDocuments(filter),
      ]);

      const formattedOffers = offers
        .map(attachLegacyOwnerFields)
        .map((offer) => {
          const formatted = formatOfferForResponse(offer);
          // Manually attach fixture details if populated
          if (offer.fixtureId && typeof offer.fixtureId === "object") {
            formatted.fixture = {
              id: offer.fixtureId._id,
              date: offer.fixtureId.date,
              homeTeam: offer.fixtureId.homeTeam,
              awayTeam: offer.fixtureId.awayTeam,
              league: offer.fixtureId.league,
              venue: offer.fixtureId.venue,
            };
            // Ensure fixtureId in response is string ID for consistency
            formatted.fixtureId = offer.fixtureId._id.toString();
          }
          return formatted;
        });

      logWithCheckpoint(
        "info",
        "Successfully fetched offers by agent",
        "AGENT_OFFER_011",
        {
          agentId,
          total,
          count: formattedOffers.length,
          page: numericPage,
          limit: numericLimit,
        }
      );

      return {
        offers: formattedOffers,
        pagination: {
          page: numericPage,
          limit: numericLimit,
          total,
          pages: Math.ceil(total / numericLimit),
        },
      };
    } catch (error) {
      logError(error, {
        operation: "AgentOfferService.getOffersByAgent",
        agentId,
        query,
      });
      throw error;
    }
  }
}

export default AgentOfferService;
