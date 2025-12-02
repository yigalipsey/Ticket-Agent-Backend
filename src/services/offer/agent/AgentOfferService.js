import Offer from "../../../models/Offer.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import { attachLegacyOwnerFields } from "../utils/offerMapper.js";

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
          select: "name whatsapp isActive imageUrl agentType companyName",
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
}

export default AgentOfferService;
