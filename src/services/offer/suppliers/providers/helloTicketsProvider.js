import axios from "axios";
import { logWithCheckpoint, logError } from "../../../../utils/logger.js";

const getHelloTicketsConfig = () => ({
  apiUrl:
    process.env.HELLOTICKETS_API_URL || "https://api-live.hellotickets.com/v1",
  apiKey: process.env.HELLO_TICETS_API_KEY,
  affiliateParams:
    process.env.HELLOTICKETS_AFFILIATE_PARAMS ||
    "tap_a=141252-18675a&tap_s=8995852-00a564",
});

const addAffiliateLink = (originalUrl, affiliateParams) => {
  if (!originalUrl) {
    return null;
  }

  const separator = originalUrl.includes("?") ? "&" : "?";
  return `${originalUrl}${separator}${affiliateParams}`;
};

export const fetchHelloTicketsOffer = async ({
  externalId,
  fixture,
  offer,
}) => {
  if (!externalId) {
    throw new Error("Missing HelloTickets performance ID");
  }

  const { apiUrl, apiKey, affiliateParams } = getHelloTicketsConfig();

  if (!apiKey) {
    throw new Error("HELLO_TICETS_API_KEY is not configured");
  }

  const checkpointBase = "SUPPLIER_HT";

  try {
    logWithCheckpoint(
      "info",
      "Requesting HelloTickets performance",
      `${checkpointBase}_REQUEST`,
      {
        performanceId: externalId,
        fixtureId: fixture?._id?.toString(),
        offerId: offer?._id?.toString(),
      }
    );

    const { data } = await axios.get(`${apiUrl}/performances/${externalId}`, {
      headers: {
        Accept: "application/json",
        "X-Public-Key": apiKey,
      },
    });

    const performance = data?.performance || data;
    if (!performance) {
      throw new Error("HelloTickets response did not include performance data");
    }

    const minPriceRaw = performance.price_range?.min_price;
    const minPrice =
      typeof minPriceRaw === "number"
        ? minPriceRaw
        : minPriceRaw !== undefined && minPriceRaw !== null
        ? Number(minPriceRaw)
        : null;

    // Determine isAvailable: if there's a price, the offer is available
    // is_sellable is not relevant - if there's a price, the offer exists
    const isAvailable = Number.isFinite(minPrice) && minPrice > 0;

    const liveData = {
      price: Number.isFinite(minPrice) ? minPrice : null,
      currency: performance.price_range?.currency || offer?.currency || "EUR",
      url:
        addAffiliateLink(performance.url, affiliateParams) ||
        offer?.url ||
        null,
      isAvailable: isAvailable,
      fetchedAt: new Date().toISOString(),
      metadata: {
        baseUrl: performance.url,
        priceRange: performance.price_range || null,
        is_sellable: performance.is_sellable, // Store original value for debugging
      },
    };

    logWithCheckpoint(
      "info",
      "HelloTickets performance fetched successfully",
      `${checkpointBase}_SUCCESS`,
      {
        performanceId: externalId,
        fixtureId: fixture?._id?.toString(),
        offerId: offer?._id?.toString(),
        minPrice: liveData.price,
        currency: liveData.currency,
        is_sellable: performance.is_sellable,
        isAvailable: liveData.isAvailable,
      }
    );

    return liveData;
  } catch (error) {
    logError(error, {
      operation: "fetchHelloTicketsOffer",
      externalId,
      fixtureId: fixture?._id?.toString(),
      offerId: offer?._id?.toString(),
    });
    throw error;
  }
};
