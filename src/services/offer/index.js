// Query functions
import { getAllOffers } from "./queries/getAllOffers.js";
import { getOfferById } from "./queries/getOfferById.js";
import { getOffersByFixtureId } from "./queries/getOffersByFixtureId.js";
import { getOffersByAgent } from "./queries/getOffersByAgent.js";

// Mutation functions
import { createOffer } from "./mutations/createOffer.js";
import { updateOffer } from "./mutations/updateOffer.js";
import { deleteOffer } from "./mutations/deleteOffer.js";
import { createMultipleOffers } from "./mutations/createMultipleOffers.js";

// Export as organized service object
export default {
  query: {
    getAllOffers,
    getOfferById,
    getOffersByFixtureId,
    getOffersByAgent,
  },
  mutate: {
    createOffer,
    updateOffer,
    deleteOffer,
    createMultipleOffers,
  },
};
