import axios from "axios";
import { logWithCheckpoint, logError } from "../../../../utils/logger.js";

const getSportsEventsConfig = () => ({
  apiKey: process.env.SPORTSEVENTS365_API_KEY,
  username: process.env.SPORTSEVENTS365_HTTP_USERNAME,
  password: process.env.SPORTSEVENTS365_HTTP_PASSWORD,
  baseUrl:
    process.env.SPORTSEVENTS365_BASE_URL ||
    "https://api-v2.sportsevents365.com",
  affiliateId: process.env.SPORTSEVENTS365_AFFILIATE_ID || "691ed35f6f829",
});

const buildAffiliateUrl = (eventUrl, apiEventId, affiliateId) => {
  if (eventUrl) {
    if (eventUrl.includes("?")) {
      return `${eventUrl}&a_aid=${affiliateId}`;
    }
    return `${eventUrl}?a_aid=${affiliateId}`;
  }

  if (apiEventId) {
    return `https://tickets-partners.com/event/?q=eq,${apiEventId}&a_aid=${affiliateId}`;
  }

  return null;
};

const createSportsEventsClient = (baseUrl, username, password) => {
  const client = axios.create({
    baseURL: baseUrl,
    timeout: 30000,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  if (username && password) {
    const authString = Buffer.from(`${username}:${password}`).toString(
      "base64"
    );
    client.defaults.headers.common["Authorization"] = `Basic ${authString}`;
  }

  return client;
};

export const fetchSportsEvents365Offer = async ({
  externalId,
  fixture,
  offer,
}) => {
  if (!externalId) {
    throw new Error("Missing Sportsevents365 event ID");
  }

  const { apiKey, username, password, baseUrl, affiliateId } =
    getSportsEventsConfig();

  if (!apiKey || !username || !password) {
    throw new Error(
      "Sportsevents365 credentials are not fully configured (API key / HTTP auth)"
    );
  }

  const sportsEventsClient = createSportsEventsClient(
    baseUrl,
    username,
    password
  );

  const checkpointBase = "SUPPLIER_365";

  try {
    logWithCheckpoint(
      "info",
      "Requesting Sportsevents365 event",
      `${checkpointBase}_REQUEST`,
      {
        eventId: externalId,
        fixtureId: fixture?._id?.toString(),
        offerId: offer?._id?.toString(),
      }
    );

    const response = await sportsEventsClient.get(`/events/${externalId}`, {
      params: { apiKey },
    });

    const payload = response.data?.data || response.data;
    if (!payload) {
      throw new Error("Sportsevents365 response did not include event data");
    }

    const rawPrice = payload.minTicketPrice?.price;
    const parsedPrice =
      typeof rawPrice === "number"
        ? rawPrice
        : rawPrice !== undefined && rawPrice !== null
        ? Number(rawPrice)
        : null;

    const liveData = {
      price: Number.isFinite(parsedPrice) ? parsedPrice : null,
      currency: payload.minTicketPrice?.currency || offer?.currency || "EUR",
      url:
        buildAffiliateUrl(payload.eventUrl, externalId, affiliateId) ||
        offer?.url ||
        null,
      isAvailable:
        (payload.availableTicketsQuantity ??
          payload.availableCategoriesQuantity ??
          0) > 0 || (parsedPrice ?? 0) > 0,
      fetchedAt: new Date().toISOString(),
      metadata: {
        minTicketPrice: payload.minTicketPrice || null,
        availableCategoriesQuantity:
          payload.availableCategoriesQuantity ?? null,
        availableTicketsQuantity: payload.availableTicketsQuantity ?? null,
      },
    };

    logWithCheckpoint(
      "info",
      "Sportsevents365 event fetched successfully",
      `${checkpointBase}_SUCCESS`,
      {
        eventId: externalId,
        fixtureId: fixture?._id?.toString(),
        offerId: offer?._id?.toString(),
        minPrice: liveData.price,
        currency: liveData.currency,
      }
    );

    return liveData;
  } catch (error) {
    logError(error, {
      operation: "fetchSportsEvents365Offer",
      externalId,
      fixtureId: fixture?._id?.toString(),
      offerId: offer?._id?.toString(),
    });
    throw error;
  }
};
