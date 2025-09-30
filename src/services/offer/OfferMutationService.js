import Offer from "../../models/Offer.js";
import FootballEvent from "../../models/FootballEvent.js";
import Agent from "../../models/Agent.js";
import { logWithCheckpoint, logError } from "../../utils/logger.js";
import { ERROR_CODES } from "../../utils/errorCodes.js";

class OfferMutationService {
  // Create new offer
  async createOffer(offerData) {
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
  }

  // Update offer
  async updateOffer(id, updateData) {
    try {
      logWithCheckpoint("info", "Starting to update offer", "OFFER_018", {
        id,
        updateData,
      });

      // Validate price if provided
      if (updateData.price !== undefined && updateData.price <= 0) {
        throw new Error("Price must be greater than 0");
      }

      const offer = await Offer.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      })
        .populate("fixtureId", "date status round tags")
        .populate("agentId", "name whatsapp isActive")
        .lean();

      if (!offer) {
        logWithCheckpoint("warn", "Offer not found for update", "OFFER_019", {
          id,
        });
        return null;
      }

      logWithCheckpoint("info", "Successfully updated offer", "OFFER_020", {
        id,
      });
      return offer;
    } catch (error) {
      logError(error, { operation: "updateOffer", id, updateData });
      throw error;
    }
  }

  // Toggle offer availability
  async toggleOfferAvailability(id) {
    try {
      logWithCheckpoint(
        "info",
        "Starting to toggle offer availability",
        "OFFER_021",
        {
          id,
        }
      );

      const offer = await Offer.findById(id);
      if (!offer) {
        throw new Error("Offer not found");
      }

      const updatedOffer = await Offer.findByIdAndUpdate(
        id,
        { isAvailable: !offer.isAvailable },
        { new: true, runValidators: true }
      )
        .populate("fixtureId", "date status round tags")
        .populate("agentId", "name whatsapp isActive")
        .lean();

      logWithCheckpoint(
        "info",
        "Successfully toggled offer availability",
        "OFFER_022",
        {
          id,
          isAvailable: updatedOffer.isAvailable,
        }
      );

      return updatedOffer;
    } catch (error) {
      logError(error, { operation: "toggleOfferAvailability", id });
      throw error;
    }
  }

  // Delete offer
  async deleteOffer(id) {
    try {
      logWithCheckpoint("info", "Starting to delete offer", "OFFER_023", {
        id,
      });

      const offer = await Offer.findByIdAndDelete(id);

      if (!offer) {
        logWithCheckpoint("warn", "Offer not found for deletion", "OFFER_024", {
          id,
        });
        return null;
      }

      logWithCheckpoint("info", "Successfully deleted offer", "OFFER_025", {
        id,
      });
      return offer;
    } catch (error) {
      logError(error, { operation: "deleteOffer", id });
      throw error;
    }
  }

  // Create multiple offers for a fixture
  async createMultipleOffers(offersData) {
    try {
      logWithCheckpoint(
        "info",
        "Starting to create multiple offers",
        "OFFER_026",
        {
          count: offersData.length,
        }
      );

      const createdOffers = [];

      for (const offerData of offersData) {
        try {
          const offer = await this.createOffer(offerData);
          createdOffers.push(offer);
        } catch (error) {
          logWithCheckpoint(
            "warn",
            "Failed to create individual offer",
            "OFFER_027",
            {
              offerData,
              error: error.message,
            }
          );
          // Continue with other offers
        }
      }

      logWithCheckpoint(
        "info",
        "Successfully created multiple offers",
        "OFFER_028",
        {
          requested: offersData.length,
          created: createdOffers.length,
        }
      );

      return createdOffers;
    } catch (error) {
      logError(error, { operation: "createMultipleOffers", offersData });
      throw error;
    }
  }
}

export default new OfferMutationService();
