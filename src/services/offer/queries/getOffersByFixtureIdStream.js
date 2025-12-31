import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import Offer from "../../../models/Offer.js";
import AgentOfferService from "../agent/AgentOfferService.js";
import SupplierStreamService from "../suppliers/SupplierStreamService.js";
import { formatOfferForResponse } from "../utils/offerMapper.js";
import { fetchFixtureWithPopulate, buildResponseFixture } from "../utils/fixtureHelpers.js";

/**
 * Stream offers by fixture ID using async generator
 * 
 * This function yields offers in chunks as they become available:
 * 1. Fixture data (immediate)
 * 2. Agent offers (fast - from DB)
 * 3. Supplier offers (one by one as they complete API calls)
 * 4. Complete event
 * 
 * @param {string} fixtureId - The fixture ID
 * @param {Object} query - Query options
 * @param {boolean} query.forceRefresh - Force refresh supplier data
 * @yields {Object} Events with type and data
 */
export async function* streamOffersByFixture(fixtureId, query = {}) {
    try {
        logWithCheckpoint(
            "info",
            "Starting to stream offers by fixture",
            "OFFER_STREAM_001",
            { fixtureId, query }
        );

        const { forceRefresh = false } = query;
        const normalizedForceRefresh = typeof forceRefresh === 'string'
            ? forceRefresh.toLowerCase() === 'true'
            : Boolean(forceRefresh);

        let totalOffers = 0;

        // 1. Fetch and yield fixture immediately
        logWithCheckpoint(
            "info",
            "Fetching fixture data",
            "OFFER_STREAM_002",
            { fixtureId }
        );

        const fixture = await fetchFixtureWithPopulate(fixtureId);
        const responseFixture = buildResponseFixture(fixture);

        yield {
            type: 'fixture',
            data: responseFixture,
        };

        logWithCheckpoint(
            "info",
            "Fixture data sent",
            "OFFER_STREAM_003",
            { fixtureId, hasFixture: !!fixture }
        );

        // 2. Fetch and yield agent offers (fast - from DB)
        logWithCheckpoint(
            "info",
            "Fetching agent offers",
            "OFFER_STREAM_004",
            { fixtureId }
        );

        const agentOffers = await AgentOfferService.getOffersByFixture(fixtureId);

        // 3. Inform client about total expected chunks for the progress bar
        // Chunks: 1 (fixture) + 1 (agent offers batch) + N (each supplier offer)
        const supplierOffersCount = await Offer.countDocuments({ fixtureId, ownerType: "Supplier" });
        const totalChunks = 1 + (agentOffers.length > 0 ? 1 : 0) + supplierOffersCount;

        yield {
            type: 'metadata',
            data: { totalChunks },
        };

        const formattedAgentOffers = agentOffers.map(formatOfferForResponse);

        if (formattedAgentOffers.length > 0) {
            yield {
                type: 'offers',
                data: {
                    offers: formattedAgentOffers,
                    source: 'agents',
                    count: formattedAgentOffers.length,
                },
            };

            totalOffers += formattedAgentOffers.length;

            logWithCheckpoint(
                "info",
                "Agent offers sent",
                "OFFER_STREAM_005",
                { fixtureId, count: formattedAgentOffers.length }
            );
        }

        // 3. Stream supplier offers one by one
        logWithCheckpoint(
            "info",
            "Starting to stream supplier offers",
            "OFFER_STREAM_006",
            { fixtureId, forceRefresh: normalizedForceRefresh }
        );

        let supplierCount = 0;
        let errorCount = 0;

        for await (const result of SupplierStreamService.streamLiveOffers(fixture, {
            forceRefresh: normalizedForceRefresh,
            fixtureId,
        })) {
            if (result.type === 'offer') {
                const formattedOffer = formatOfferForResponse(result.offer);

                yield {
                    type: 'offer',
                    data: {
                        offer: formattedOffer,
                        source: 'supplier',
                        fromCache: result.fromCache,
                        isLive: result.isLive,
                    },
                };

                supplierCount++;
                totalOffers++;

            } else if (result.type === 'error') {
                errorCount++;

                yield {
                    type: 'error',
                    data: {
                        offerId: result.offerId,
                        message: result.error,
                    },
                };
            }
        }

        logWithCheckpoint(
            "info",
            "Supplier offers streaming completed",
            "OFFER_STREAM_007",
            {
                fixtureId,
                supplierCount,
                errorCount,
                totalOffers,
            }
        );

        // 4. Send complete event
        yield {
            type: 'complete',
            data: {
                total: totalOffers,
                agents: formattedAgentOffers.length,
                suppliers: supplierCount,
                errors: errorCount,
            },
        };

        logWithCheckpoint(
            "info",
            "Successfully completed streaming offers by fixture",
            "OFFER_STREAM_008",
            {
                fixtureId,
                totalOffers,
                agents: formattedAgentOffers.length,
                suppliers: supplierCount,
            }
        );

    } catch (error) {
        logError(error, {
            operation: "streamOffersByFixture",
            fixtureId,
            query
        });

        // Yield error event
        yield {
            type: 'error',
            data: {
                message: error.message,
                fatal: true,
            },
        };

        throw error;
    }
}
