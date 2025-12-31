import Offer from "../../../models/Offer.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import { attachLegacyOwnerFields, toObjectIdString } from "../utils/offerMapper.js";
import SupplierApiService from "./SupplierApiService.js";

/**
 * SupplierStreamService
 * 
 * Streaming version of SupplierApiService that yields offers one by one
 * instead of waiting for Promise.all
 */
class SupplierStreamService {
    /**
     * Stream live supplier offers one by one
     * 
     * @param {Object} fixture - Fixture object with supplierExternalIds
     * @param {Object} options - Options
     * @param {boolean} options.forceRefresh - Force refresh from API
     * @param {string} options.fixtureId - Fixture ID override
     * @yields {Object} Individual offer results as they complete
     */
    static async* streamLiveOffers(fixture, { forceRefresh = false, fixtureId: fixtureIdOverride } = {}) {
        const fixtureId = fixtureIdOverride || fixture?._id?.toString();

        if (!fixtureId) {
            throw new Error("SupplierStreamService.streamLiveOffers requires a fixtureId");
        }

        try {
            logWithCheckpoint(
                "info",
                "Loading supplier offers from database for streaming",
                "SUPPLIER_STREAM_001",
                { fixtureId, forceRefresh }
            );

            // Load all supplier offers from DB
            const offers = await Offer.find({
                fixtureId,
                ownerType: "Supplier",
            })
                .populate({
                    path: "ownerId",
                    select: "name slug imageUrl logoUrl syncConfig isActive priority metadata affiliateLinkBase externalRating",
                })
                .lean();

            if (!offers.length) {
                logWithCheckpoint(
                    "info",
                    "No supplier offers found for fixture",
                    "SUPPLIER_STREAM_002",
                    { fixtureId }
                );
                return;
            }

            logWithCheckpoint(
                "info",
                "Starting to stream supplier offers",
                "SUPPLIER_STREAM_003",
                { fixtureId, totalOffers: offers.length }
            );

            // Stream each offer individually
            for (const offer of offers) {
                try {
                    // Check if this offer should use live fetcher
                    const shouldFetch = SupplierApiService.shouldUseLiveFetcher?.(offer) ??
                        this._shouldUseLiveFetcher(offer);

                    if (!shouldFetch) {
                        // Return static offer without live fetch
                        yield {
                            type: 'offer',
                            offer: attachLegacyOwnerFields(offer),
                            fromCache: false,
                            isLive: false,
                        };
                        continue;
                    }

                    // Fetch live data for this offer
                    const result = await SupplierApiService.fetchLiveDataForOffer({
                        fixture,
                        offer,
                        forceRefresh,
                    });

                    if (result.skipped) {
                        // Offer was skipped, return as-is
                        yield {
                            type: 'offer',
                            offer: attachLegacyOwnerFields(offer),
                            fromCache: false,
                            isLive: false,
                        };
                        continue;
                    }

                    // Apply live data to offer
                    if (result.data) {
                        const supplierId = result.supplierId;
                        const supplierConfig = SupplierApiService.LIVE_SUPPLIER_FETCHERS?.[supplierId];

                        await SupplierApiService.applyLiveDataToOffer({
                            offer,
                            liveData: result.data,
                            supplierConfig,
                            fromCache: Boolean(result.fromCache),
                        });
                    }

                    // Yield the updated offer
                    yield {
                        type: 'offer',
                        offer: attachLegacyOwnerFields(offer),
                        fromCache: Boolean(result.fromCache),
                        isLive: true,
                    };

                } catch (error) {
                    logError(error, {
                        operation: "SupplierStreamService.streamLiveOffers - individual offer",
                        offerId: offer._id,
                        fixtureId,
                    });

                    // Yield error but continue with other offers
                    yield {
                        type: 'error',
                        offerId: offer._id,
                        error: error.message,
                    };
                }
            }

            logWithCheckpoint(
                "info",
                "Finished streaming supplier offers",
                "SUPPLIER_STREAM_004",
                { fixtureId, totalOffers: offers.length }
            );

        } catch (error) {
            logError(error, {
                operation: "SupplierStreamService.streamLiveOffers",
                fixtureId,
            });
            throw error;
        }
    }

    /**
     * Fallback method to check if offer should use live fetcher
     * (in case SupplierApiService doesn't expose it)
     */
    static _shouldUseLiveFetcher(offer) {
        const supplierId = toObjectIdString(offer?.ownerId?._id || offer?.ownerId);
        const LIVE_SUPPLIER_IDS = [
            "692476c8b4f389968e1f00f5", // HelloTickets
            "692c5e80270da1b2ea057dd9", // SportsEvents365
            "69527c33352a6ab3197b5e21", // Arena Tickets
        ];
        return LIVE_SUPPLIER_IDS.includes(supplierId);
    }
}

export default SupplierStreamService;
