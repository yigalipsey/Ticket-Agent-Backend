import Offer from "../../../models/Offer.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";

/**
 * Get all offers with pagination and filtering
 */
export const getAllOffers = async (query = {}) => {
  try {
    logWithCheckpoint("info", "Starting to fetch all offers", "OFFER_001", {
      query,
    });

    const {
      page = 1,
      limit = 20,
      fixtureId,
      agentId,
      isAvailable,
      currency,
      minPrice,
      maxPrice,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    // Build filter object
    const filter = {};

    if (fixtureId) {
      filter.fixtureId = fixtureId;
      logWithCheckpoint("debug", "Added fixtureId filter", "OFFER_002", {
        fixtureId,
      });
    }

    if (agentId) {
      filter.agentId = agentId;
      logWithCheckpoint("debug", "Added agentId filter", "OFFER_003", {
        agentId,
      });
    }

    if (isAvailable !== undefined) {
      filter.isAvailable = isAvailable === "true";
      logWithCheckpoint("debug", "Added isAvailable filter", "OFFER_004", {
        isAvailable: filter.isAvailable,
      });
    }

    if (currency) {
      filter.currency = currency;
      logWithCheckpoint("debug", "Added currency filter", "OFFER_005", {
        currency,
      });
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
      logWithCheckpoint("debug", "Added price range filter", "OFFER_006", {
        minPrice,
        maxPrice,
      });
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const skip = (page - 1) * limit;

    logWithCheckpoint("info", "Executing database query", "OFFER_007", {
      filter,
      sort,
      skip,
      limit,
    });

    const [offers, total] = await Promise.all([
      Offer.find(filter)
        .populate("fixtureId", "date status round tags")
        .populate("agentId", "name whatsapp isActive")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Offer.countDocuments(filter),
    ]);

    logWithCheckpoint("info", "Successfully fetched offers", "OFFER_008", {
      count: offers.length,
      total,
    });

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
    logError(error, { operation: "getAllOffers", query });
    throw error;
  }
};
