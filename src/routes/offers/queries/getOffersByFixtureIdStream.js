import express from "express";
import { logError } from "../../../utils/logger.js";
import { rateLimit } from "../../../middleware/userAuth.js";
import { validateObjectIdParam } from "../../../middleware/validateObjectId.js";
import { setupSSEHeaders, sendSSEEvent, closeSSEConnection } from "../../../utils/sseHelpers.js";
import { streamOffersByFixture } from "../../../services/offer/queries/getOffersByFixtureIdStream.js";

const router = express.Router();

// GET /api/offers/fixture/:fixtureId/stream - Stream offers by fixture ID using SSE
router.get(
    "/fixture/:fixtureId/stream",
    validateObjectIdParam("fixtureId"),
    rateLimit(1000),
    async (req, res) => {
        const { fixtureId } = req.params;

        // Setup SSE headers
        setupSSEHeaders(res);

        // Track client connection state
        let clientDisconnected = false;
        let isFinishedSuccessfully = false;
        let isError = false;
        const startTime = Date.now();

        req.on('close', () => {
            const duration = (Date.now() - startTime) / 1000;
            clientDisconnected = true;

            if (isFinishedSuccessfully) {
                console.log(`✅ Connection closed normally after completion: ${fixtureId} (${duration}s)`);
            } else if (isError) {
                console.log(`❌ Connection closed due to server error: ${fixtureId} (${duration}s)`);
            } else {
                console.log(`⚠️ Client DISCONNECTED prematurely: ${fixtureId} (${duration}s). This is normal during dev reloads.`);
            }
        });

        // Keep-alive heartbeat to prevent proxy/browser timeouts
        const heartbeatInterval = setInterval(() => {
            if (!clientDisconnected) {
                try {
                    res.write(': heartbeat\n\n');
                } catch (error) {
                    clearInterval(heartbeatInterval);
                }
            }
        }, 15000); // Every 15 seconds

        try {
            // Stream offers using async generator
            for await (const event of streamOffersByFixture(fixtureId, req.query)) {
                // Check if client disconnected
                if (clientDisconnected) break;

                // Send event - service already provides type and data
                if (event.type && event.data) {
                    sendSSEEvent(res, event.type, event.data);
                }

                // Set success flag and stop after complete event
                if (event.type === 'complete') {
                    isFinishedSuccessfully = true;
                    break;
                }
            }

        } catch (error) {
            isError = true;
            logError(error, {
                route: "GET /api/offers/fixture/:fixtureId/stream",
                fixtureId,
                query: req.query,
            });

            // Try to send error event if connection is still open
            if (!clientDisconnected) {
                try {
                    sendSSEEvent(res, 'error', {
                        message: 'Internal server error',
                        fatal: true,
                    });
                } catch (sendError) {
                    console.error('Failed to send error event:', sendError);
                }
            }

        } finally {
            // Cleanup: stop heartbeat and close connection
            clearInterval(heartbeatInterval);
            closeSSEConnection(res);
        }
    }
);

export default router;
