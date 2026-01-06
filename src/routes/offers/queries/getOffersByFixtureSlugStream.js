import express from "express";
import { logError } from "../../../utils/logger.js";
import { rateLimit } from "../../../middleware/userAuth.js";
import {
  setupSSEHeaders,
  sendSSEEvent,
  closeSSEConnection,
} from "../../../utils/sseHelpers.js";
import { streamOffersByFixture } from "../../../services/offer/queries/getOffersByFixtureIdStream.js";
import { getFixtureIdBySlug } from "../../../services/footballFixtures/queries/getFixtureIdBySlug.js";
import { createErrorResponse } from "../../../utils/errorCodes.js";

const router = express.Router();

// GET /api/offers/fixture-slug/stream/:slug - Stream offers by fixture slug using SSE
router.get("/fixture-slug/stream/:slug", rateLimit(1000), async (req, res) => {
  const { slug } = req.params;

  if (!slug) {
    return res.status(400).json(
      createErrorResponse("VALIDATION_MISSING_FIELDS", {
        required: ["slug"],
        message: "Slug is required",
      })
    );
  }

  try {
    // Step 1: Get fixture ID by slug
    const fixtureIdResult = await getFixtureIdBySlug(slug);
    const fixtureFound = !!(fixtureIdResult && fixtureIdResult._id);

    console.log(
      `\x1b[35m%s\x1b[0m`,
      `🔍 [SSE Slug Match] Slug: ${slug} | Found: ${fixtureFound ? "✅ YES" : "❌ NO"}`
    );

    if (!fixtureFound) {
      return res.status(404).json(createErrorResponse("FIXTURE_NOT_FOUND", {
        message: `Fixture with slug "${slug}" not found`
      }));
    }

    const fixtureId = fixtureIdResult._id;

    // Track client connection state
    let clientDisconnected = false;
    let isFinishedSuccessfully = false;
    let isError = false;
    const startTime = Date.now();

    // Setup SSE headers ONLY after we know we have a fixture
    setupSSEHeaders(res);

    req.on("close", () => {
      const duration = (Date.now() - startTime) / 1000;
      clientDisconnected = true;

      if (isFinishedSuccessfully) {
        console.log(
          `✅ Connection closed normally after completion: ${slug} (${duration}s)`
        );
      } else if (isError) {
        console.log(
          `❌ Connection closed due to server error: ${slug} (${duration}s)`
        );
      } else {
        console.log(
          `⚠️ Client DISCONNECTED prematurely: ${slug} (${duration}s). This is normal during dev reloads.`
        );
      }
    });

    // Keep-alive heartbeat to prevent proxy/browser timeouts
    const heartbeatInterval = setInterval(() => {
      if (!clientDisconnected) {
        try {
          res.write(": heartbeat\n\n");
        } catch (error) {
          clearInterval(heartbeatInterval);
        }
      }
    }, 15000); // Every 15 seconds

    try {
      // Step 2: Stream offers using async generator
      for await (const event of streamOffersByFixture(fixtureId, req.query)) {
        // Check if client disconnected
        if (clientDisconnected) break;

        // Send event - service already provides type and data
        if (event.type && event.data) {
          sendSSEEvent(res, event.type, event.data);
        }

        // Set success flag and stop after complete event
        if (event.type === "complete") {
          isFinishedSuccessfully = true;
          break;
        }
      }
    } catch (error) {
      isError = true;
      logError(error, {
        route: "GET /api/offers/fixture-slug/:slug/stream",
        slug,
        query: req.query,
      });

      // Try to send error event if connection is still open
      if (!clientDisconnected) {
        try {
          sendSSEEvent(res, "error", {
            message: "Internal server error",
            fatal: true,
          });
        } catch (sendError) {
          console.error("Failed to send error event:", sendError);
        }
      }
    } finally {
      // Cleanup: stop heartbeat and close connection
      clearInterval(heartbeatInterval);
      closeSSEConnection(res);
    }
  } catch (error) {
    logError(error, {
      route: "GET /api/offers/fixture-slug/:slug/stream",
      slug,
    });
    return res.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
  }
});

export default router;
