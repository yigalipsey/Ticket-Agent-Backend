// Query functions
import { getOffersByFixtureId } from "./queries/getOffersByFixtureId.js";

// Mutation functions
import { createOffer } from "./mutations/createOffer.js";
import { deleteOffer } from "./mutations/deleteOffer.js";

// Cache helper functions
import {
  refreshOffersCache,
  clearOffersCache,
  getOffersWithCacheRefresh,
} from "./utils/cacheHelpers.js";

// Export as organized service object
export default {
  query: {
    getOffersByFixtureId,
  },
  mutate: {
    createOffer,
    deleteOffer,
  },
  cache: {
    refreshOffersCache,
    clearOffersCache,
    getOffersWithCacheRefresh,
  },
};
