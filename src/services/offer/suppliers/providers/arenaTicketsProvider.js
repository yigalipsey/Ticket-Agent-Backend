import axios from "axios";
import { logWithCheckpoint, logError } from "../../../../utils/logger.js";

const getArenaConfig = () => ({
    consumerKey: process.env.ARENA_CONSUMER_KEY,
    consumerSecret: process.env.ARENA_CONSUMER_SECRET,
    baseUrl:
        process.env.ARENA_API_URL || "https://arenatickets.co.il/wp-json/wc/v3",
    affiliateParams: process.env.ARENA_AFFILIATE_PARAMS || "",
});

const addAffiliateLink = (originalUrl, affiliateParams) => {
    if (!originalUrl || !affiliateParams) {
        return originalUrl;
    }

    const separator = originalUrl.includes("?") ? "&" : "?";
    return `${originalUrl}${separator}${affiliateParams}`;
};

/**
 * Fetch live offer data from Arena Tickets API
 * @param {Object} params
 * @param {string} params.externalId - Arena product ID
 * @param {Object} params.fixture - Fixture object
 * @param {Object} params.offer - Offer object
 * @returns {Promise<Object>} Live offer data
 */
export const fetchArenaTicketsOffer = async ({
    externalId,
    fixture,
    offer,
}) => {
    if (!externalId) {
        throw new Error("Missing Arena Tickets product ID");
    }

    const { consumerKey, consumerSecret, baseUrl, affiliateParams } =
        getArenaConfig();

    if (!consumerKey || !consumerSecret) {
        throw new Error(
            "Arena Tickets credentials are not configured (ARENA_CONSUMER_KEY / ARENA_CONSUMER_SECRET)"
        );
    }

    const checkpointBase = "SUPPLIER_ARENA";

    try {
        logWithCheckpoint(
            "info",
            "Requesting Arena Tickets product",
            `${checkpointBase}_REQUEST`,
            {
                productId: externalId,
                fixtureId: fixture?._id?.toString(),
                offerId: offer?._id?.toString(),
            }
        );

        // Create Basic Auth header
        const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString(
            "base64"
        );

        // Fetch product details
        const { data: product } = await axios.get(
            `${baseUrl}/products/${externalId}`,
            {
                headers: {
                    Authorization: `Basic ${auth}`,
                    Accept: "application/json",
                },
            }
        );

        if (!product) {
            throw new Error("Arena Tickets response did not include product data");
        }

        // Fetch variations to get all category prices
        const { data: variations } = await axios.get(
            `${baseUrl}/products/${externalId}/variations`,
            {
                headers: {
                    Authorization: `Basic ${auth}`,
                    Accept: "application/json",
                },
            }
        );

        // Find minimum price from all variations
        let minPrice = null;
        if (variations && Array.isArray(variations) && variations.length > 0) {
            const prices = variations
                .map((v) => parseFloat(v.price))
                .filter((p) => !isNaN(p) && p > 0);

            if (prices.length > 0) {
                minPrice = Math.min(...prices);
            }
        }

        // Fallback to main product price if no variations
        if (minPrice === null) {
            const mainPrice = parseFloat(product.price);
            if (!isNaN(mainPrice) && mainPrice > 0) {
                minPrice = mainPrice;
            }
        }

        // Determine availability
        const isAvailable =
            product.stock_status === "instock" &&
            minPrice !== null &&
            minPrice > 0;

        const liveData = {
            price: minPrice,
            currency: "ILS", // Arena always uses ILS
            url: addAffiliateLink(product.permalink, affiliateParams) || offer?.url || null,
            isAvailable: isAvailable,
            fetchedAt: new Date().toISOString(),
            metadata: {
                baseUrl: product.permalink,
                stockStatus: product.stock_status,
                variationsCount: variations?.length || 0,
                priceRange: product.price_html || null,
            },
        };

        logWithCheckpoint(
            "info",
            "Arena Tickets product fetched successfully",
            `${checkpointBase}_SUCCESS`,
            {
                productId: externalId,
                fixtureId: fixture?._id?.toString(),
                offerId: offer?._id?.toString(),
                minPrice: liveData.price,
                currency: liveData.currency,
                stockStatus: product.stock_status,
                isAvailable: liveData.isAvailable,
                variationsCount: variations?.length,
            }
        );

        return liveData;
    } catch (error) {
        logError(error, {
            operation: "fetchArenaTicketsOffer",
            externalId,
            fixtureId: fixture?._id?.toString(),
            offerId: offer?._id?.toString(),
        });
        throw error;
    }
};
