import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import { createOffer } from "./createOffer.js";

/**
 * Create multiple offers for a fixture
 */
export const createMultipleOffers = async (offersData) => {
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
        const offer = await createOffer(offerData);
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
};
