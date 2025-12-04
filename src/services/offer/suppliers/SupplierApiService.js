import { LRUCache } from "lru-cache";
import Offer from "../../../models/Offer.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import {
  attachLegacyOwnerFields,
  toObjectIdString,
} from "../utils/offerMapper.js";
import { fetchHelloTicketsOffer } from "./providers/helloTicketsProvider.js";
import { fetchSportsEvents365Offer } from "./providers/sportsEvents365Provider.js";
import { updateOfferPrice } from "../mutations/updateOffer.js";
import { updateFixtureMinPrice } from "../utils/fixtureMinPriceService.js";

const LIVE_SUPPLIER_FETCHERS = {
  "692476c8b4f389968e1f00f5": {
    slug: "hellotickets",
    name: "HelloTickets",
    fetcher: fetchHelloTicketsOffer,
  },
  "692c5e80270da1b2ea057dd9": {
    slug: "sportsevents365",
    name: "Sportsevents365",
    fetcher: fetchSportsEvents365Offer,
  },
};

const DEFAULT_CACHE_TTL_MS = parseInt(
  process.env.SUPPLIER_LIVE_CACHE_TTL_MS || `${5 * 60 * 1000}`,
  10
);

const liveOfferCache = new LRUCache({
  max: 300,
  ttl: DEFAULT_CACHE_TTL_MS,
});

const getSupplierExternalMapping = (fixture, supplierId) => {
  if (!fixture?.supplierExternalIds?.length) {
    return null;
  }

  return fixture.supplierExternalIds.find((mapping) => {
    const ref =
      mapping.supplierRef?._id?.toString() || mapping.supplierRef?.toString();
    return ref === supplierId;
  });
};

const shouldUseLiveFetcher = (offer) => {
  const supplierId = toObjectIdString(offer?.ownerId?._id || offer?.ownerId);
  return Boolean(supplierId && LIVE_SUPPLIER_FETCHERS[supplierId]);
};

class SupplierApiService {
  static async getOffersByFixture(
    fixture,
    { forceRefresh = false, fixtureId: fixtureIdOverride } = {}
  ) {
    const fixtureId = fixtureIdOverride || fixture?._id?.toString();

    if (!fixtureId) {
      throw new Error(
        "SupplierApiService.getOffersByFixture requires a fixtureId"
      );
    }

    try {
      logWithCheckpoint(
        "info",
        "Loading supplier offers from database",
        "SUPPLIER_API_001",
        {
          fixtureId,
          forceRefresh,
        }
      );

      const offers = await Offer.find({
        fixtureId,
        ownerType: "Supplier",
      })
        .populate({
          path: "ownerId",
          select:
            "name slug imageUrl logoUrl syncConfig isActive priority metadata affiliateLinkBase externalRating",
        })
        .lean();

      if (!offers.length) {
        logWithCheckpoint(
          "info",
          "No supplier offers found for fixture",
          "SUPPLIER_API_002",
          { fixtureId }
        );
        return [];
      }

      const liveCandidates = offers.filter(shouldUseLiveFetcher);

      if (liveCandidates.length > 0) {
        await this.refreshLiveSupplierOffers({
          fixture,
          offers,
          liveCandidates,
          forceRefresh,
        });
      }

      logWithCheckpoint("info", "Supplier offers ready", "SUPPLIER_API_003", {
        fixtureId,
        totalOffers: offers.length,
        liveSuppliers: liveCandidates.length,
      });

      return offers.map(attachLegacyOwnerFields);
    } catch (error) {
      logError(error, {
        operation: "SupplierApiService.getOffersByFixture",
        fixtureId,
      });
      throw error;
    }
  }

  static async refreshLiveSupplierOffers({
    fixture,
    offers,
    liveCandidates,
    forceRefresh,
  }) {
    const fixtureId = fixture?._id?.toString();
    const refreshTasks = liveCandidates.map((offer) =>
      this.fetchLiveDataForOffer({
        fixture,
        offer,
        forceRefresh,
      })
    );

    const results = await Promise.allSettled(refreshTasks);

    let refreshed = 0;
    let cachedHits = 0;
    let failures = 0;

    for (const result of results) {
      if (result.status !== "fulfilled") {
        failures += 1;
        logError(result.reason, {
          operation: "SupplierApiService.refreshLiveSupplierOffers",
          fixtureId,
        });
        continue;
      }

      const { offerId, data, supplierId, fromCache } = result.value || {};
      if (!offerId || !data) {
        if (result.value?.fromCache) {
          cachedHits += 1;
        }
        continue;
      }

      const offer = offers.find(
        (entry) => entry._id?.toString() === offerId.toString()
      );

      if (!offer) {
        failures += 1;
        continue;
      }

      const supplierConfig = LIVE_SUPPLIER_FETCHERS[supplierId];
      try {
        const { persisted } = await this.applyLiveDataToOffer({
          offer,
          liveData: data,
          supplierConfig,
          fromCache: Boolean(fromCache),
        });

        if (fromCache) {
          cachedHits += 1;
        } else if (persisted || Number.isFinite(data.price)) {
          refreshed += 1;
        }
      } catch (error) {
        failures += 1;
        logError(error, {
          operation: "SupplierApiService.applyLiveDataToOffer",
          offerId,
          fixtureId,
        });
      }
    }

    logWithCheckpoint(
      "info",
      "Live supplier refresh completed",
      "SUPPLIER_API_004",
      {
        fixtureId,
        refreshed,
        cachedHits,
        failures,
        totalLiveSuppliers: liveCandidates.length,
      }
    );
  }

  static async fetchLiveDataForOffer({ fixture, offer, forceRefresh }) {
    const supplierId = toObjectIdString(offer.ownerId?._id || offer.ownerId);
    const supplierConfig = LIVE_SUPPLIER_FETCHERS[supplierId];

    if (!supplierConfig) {
      return {
        offerId: offer._id?.toString(),
        supplierId,
        skipped: true,
      };
    }

    const cacheKey = `${supplierId}:${fixture?._id?.toString()}`;

    if (!forceRefresh) {
      const cached = liveOfferCache.get(cacheKey);
      if (cached) {
        logWithCheckpoint(
          "info",
          "Returning supplier offer from cache",
          "SUPPLIER_API_CACHE_HIT",
          {
            supplier: supplierConfig.slug,
            fixtureId: fixture?._id?.toString(),
            offerId: offer._id?.toString(),
          }
        );

        return {
          offerId: offer._id?.toString(),
          supplierId,
          data: cached,
          fromCache: true,
        };
      }
    }

    const mapping = getSupplierExternalMapping(fixture, supplierId);
    if (!mapping?.supplierExternalId) {
      logWithCheckpoint(
        "warn",
        "Missing supplierExternalId for fixture",
        "SUPPLIER_API_NO_MAPPING",
        {
          supplier: supplierConfig.slug,
          fixtureId: fixture?._id?.toString(),
          offerId: offer._id?.toString(),
        }
      );

      return {
        offerId: offer._id?.toString(),
        supplierId,
        skipped: true,
      };
    }

    const liveData = await supplierConfig.fetcher({
      externalId: mapping.supplierExternalId,
      fixture,
      offer,
      supplier: offer.ownerId,
      mapping,
    });

    liveOfferCache.set(cacheKey, liveData);

    return {
      offerId: offer._id?.toString(),
      supplierId,
      data: liveData,
      fromCache: false,
    };
  }

  static async applyLiveDataToOffer({
    offer,
    liveData,
    supplierConfig,
    fromCache,
  }) {
    if (!liveData || !offer) {
      return { persisted: false };
    }

    const nonPriceUpdates = {};
    const priceUpdatePayload = {};

    if (Number.isFinite(liveData.price)) {
      if (offer.price !== liveData.price) {
        priceUpdatePayload.price = liveData.price;
      }
      offer.price = liveData.price;
    }

    if (liveData.currency) {
      if (offer.currency !== liveData.currency) {
        priceUpdatePayload.currency = liveData.currency;
      }
      offer.currency = liveData.currency;
    }

    if (typeof liveData.isAvailable === "boolean") {
      if (offer.isAvailable !== liveData.isAvailable) {
        nonPriceUpdates.isAvailable = liveData.isAvailable;
      }
      offer.isAvailable = liveData.isAvailable;
    }

    if (liveData.url && offer.url !== liveData.url) {
      nonPriceUpdates.url = liveData.url;
      offer.url = liveData.url;
    }

    if (liveData.metadata) {
      offer.supplierMetadata = liveData.metadata;
    }

    offer.livePricing = {
      source: supplierConfig?.slug || "supplier",
      fetchedAt: liveData.fetchedAt || new Date().toISOString(),
      fromCache,
      supplierName: supplierConfig?.name,
      price: liveData.price ?? null,
      currency: liveData.currency ?? null,
    };

    let persisted = false;

    if (Object.keys(priceUpdatePayload).length > 0) {
      await updateOfferPrice(offer._id, priceUpdatePayload);
      persisted = true;
      // updateOfferPrice already calls updateFixtureMinPrice internally
    }

    if (Object.keys(nonPriceUpdates).length > 0) {
      await Offer.updateOne(
        { _id: offer._id },
        { $set: nonPriceUpdates, $currentDate: { updatedAt: true } }
      );
      persisted = true;

      // אם יש עדכון של isAvailable, צריך לבדוק אם minPrice צריך להתעדכן
      // (כי אם ההצעה הכי נמוכה הפכה ללא זמינה, צריך למצוא את ההצעה הכי נמוכה הבאה)
      if (nonPriceUpdates.isAvailable !== undefined && offer.fixtureId) {
        try {
          await updateFixtureMinPrice(offer.fixtureId, {
            refreshCache: false, // לא לרענן cache כאן כי זה חלק מתהליך שליפה
          });
        } catch (error) {
          logError(error, {
            operation: "updateFixtureMinPrice in SupplierApiService",
            offerId: offer._id,
            fixtureId: offer.fixtureId,
          });
          // ממשיכים גם אם יש שגיאה בעדכון minPrice
        }
      }
    }

    return { persisted };
  }
}

export default SupplierApiService;
