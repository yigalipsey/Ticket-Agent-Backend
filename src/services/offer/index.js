// Query functions
import { getOffersByFixtureId } from "./queries/getOffersByFixtureId.js";
import { streamOffersByFixture } from "./queries/getOffersByFixtureIdStream.js";

// Mutation functions
import { createOffer } from "./mutations/createOffer.js";
import { updateOffer } from "./mutations/updateOffer.js";
import { deleteOffer } from "./mutations/deleteOffer.js";

// Cache helper functions
import {
  refreshOffersCache,
  clearOffersCache,
  getOffersWithCacheRefresh,
} from "./utils/cacheHelpers.js";

// Fixture minPrice service
import { updateFixtureMinPrice } from "./utils/fixtureMinPriceService.js";

// Export as organized service object
export default {
  query: {
    getOffersByFixtureId,
    streamOffersByFixture,
  },
  mutate: {
    createOffer,
    updateOffer,
    deleteOffer,
  },
  cache: {
    refreshOffersCache,
    clearOffersCache,
    getOffersWithCacheRefresh,
  },
  fixture: {
    updateFixtureMinPrice,
  },
};
