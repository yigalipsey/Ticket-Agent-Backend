import Offer from "../../../models/Offer.js";
import FootballEvent from "../../../models/FootballEvent.js";
import Agent from "../../../models/Agent.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";

/**
 * Create new offer
 */
export const createOffer = async (offerData) => {
  try {
    logWithCheckpoint("info", "Starting to create new offer", "OFFER_016", {
      offerData,
    });

    const {
      fixtureId,
      agentId,
      price,
      currency,
      description,
      source,
      metadata,
    } = offerData;

    // Validate required fields
    if (!fixtureId || !agentId || !price) {
      throw new Error(
        "Missing required fields: fixtureId, agentId, and price are required"
      );
    }

    // Validate fixture exists
    const fixture = await FootballEvent.findById(fixtureId);
    if (!fixture) {
      const error = new Error("Fixture not found");
      error.code = "FIXTURE_NOT_FOUND";
      error.statusCode = 404;
      throw error;
    }

    // Validate agent exists and is active
    const agent = await Agent.findById(agentId);
    if (!agent) {
      const error = new Error("Agent not found");
      error.code = "AGENT_NOT_FOUND";
      error.statusCode = 404;
      throw error;
    }
    if (!agent.isActive) {
      const error = new Error("Agent is not active");
      error.code = "AGENT_INACTIVE";
      error.statusCode = 403;
      throw error;
    }

    // Validate price
    if (price <= 0) {
      throw new Error("Price must be greater than 0");
    }

    const newOffer = new Offer({
      fixtureId,
      agentId,
      price,
      currency: currency || "EUR",
      description,
      source: source || "direct",
      metadata,
      isAvailable: true,
    });

    const savedOffer = await newOffer.save();

    logWithCheckpoint("info", "Successfully created offer", "OFFER_017", {
      id: savedOffer._id,
    });

    return savedOffer;
  } catch (error) {
    logError(error, { operation: "createOffer", offerData });
    throw error;
  }
};
