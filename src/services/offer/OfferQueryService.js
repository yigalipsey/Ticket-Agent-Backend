import Offer from "../../models/Offer.js";
import { logWithCheckpoint, logError } from "../../utils/logger.js";

class OfferQueryService {
  // Get all offers with pagination and filtering
  async getAllOffers(query = {}) {
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
  }

  // Get offer by ID
  async getOfferById(id) {
    try {
      logWithCheckpoint("info", "Starting to fetch offer by ID", "OFFER_009", {
        id,
      });

      const offer = await Offer.findById(id)
        .populate("fixtureId", "date status round tags")
        .populate("agentId", "name whatsapp isActive")
        .lean();

      if (!offer) {
        logWithCheckpoint("warn", "Offer not found", "OFFER_010", { id });
        return null;
      }

      logWithCheckpoint("info", "Successfully fetched offer", "OFFER_011", {
        id,
      });
      return offer;
    } catch (error) {
      logError(error, { operation: "getOfferById", id });
      throw error;
    }
  }

  // Get offers by fixture
  async getOffersByFixture(fixtureId, query = {}) {
    try {
      logWithCheckpoint(
        "info",
        "Starting to fetch offers by fixture",
        "OFFER_012",
        {
          fixtureId,
          query,
        }
      );

      const {
        page = 1,
        limit = 20,
        isAvailable = true,
        sortBy = "price",
        sortOrder = "asc",
      } = query;

      const filter = {
        fixtureId,
        isAvailable,
      };

      const sort = {};
      sort[sortBy] = sortOrder === "desc" ? -1 : 1;

      const skip = (page - 1) * limit;

      const [offers, total] = await Promise.all([
        Offer.find(filter)
          .populate("agentId", "name whatsapp isActive")
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Offer.countDocuments(filter),
      ]);

      logWithCheckpoint(
        "info",
        "Successfully fetched offers by fixture",
        "OFFER_013",
        {
          fixtureId,
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
      logError(error, { operation: "getOffersByFixture", fixtureId, query });
      throw error;
    }
  }

  // Get offers by agent
  async getOffersByAgent(agentId, query = {}) {
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
  }
}

export default new OfferQueryService();
