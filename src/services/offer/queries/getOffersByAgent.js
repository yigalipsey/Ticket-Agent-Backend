import Offer from "../../../models/Offer.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";

/**
 * Get offers by agent
 */
export const getOffersByAgent = async (agentId, query = {}) => {
  try {
    logWithCheckpoint(
      "info",
      "Starting to fetch offers by agent",
      "OFFER_014",
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

    const filter = { agentId };

    if (isAvailable !== undefined) {
      filter.isAvailable = isAvailable === "true";
    }

    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const skip = (page - 1) * limit;

    const [offers, total] = await Promise.all([
      Offer.find(filter)
        .populate("fixtureId", "date status round tags")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Offer.countDocuments(filter),
    ]);

    logWithCheckpoint(
      "info",
      "Successfully fetched offers by agent",
      "OFFER_015",
      {
        agentId,
        count: offers.length,
        total,
      }
    );

    return {
      offers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logError(error, { operation: "getOffersByAgent", agentId, query });
    throw error;
  }
};
