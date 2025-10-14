import Offer from "../../../models/Offer.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";

/**
 * Toggle offer availability
 */
export const toggleOfferAvailability = async (id) => {
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
};
