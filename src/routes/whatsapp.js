import express from "express";
import whatsAppSearchService from "../services/whatsapp/WhatsAppSearchService.js";
import { createErrorResponse } from "../utils/errorCodes.js";
import { createSuccessResponse } from "../utils/successCodes.js";

const router = express.Router();

/**
 * POST /api/whatsapp/offers/natural-language
 * Search for offers by natural language query
 *
 * Body: {
 *   query: "סיטי נגד יונייטד",  // Required - natural language query
 *   date?: "2026-01-17"          // Optional - if not provided, finds closest upcoming match
 * }
 */
router.post("/offers/natural-language", async (req, res) => {
  const { query, date } = req.body;
  const result = await whatsAppSearchService.searchGame(query, date);

  console.log("\n🔵 [ROUTE DEBUG] Service result:", {
    success: result.success,
    dataType: typeof result.data,
    dataIsArray: Array.isArray(result.data),
    dataLength: result.data?.length || 0,
    statusCode: result.statusCode,
  });

  if (!result.success) {
    const errorResponse = createErrorResponse(
      result.error?.code || "INTERNAL_SERVER_ERROR",
      result.error?.message || result.error
    );
    if (result.suggestions) {
      errorResponse.error.suggestions = result.suggestions;
    }
    return res.status(result.statusCode || 500).json(errorResponse);
  }

  const response = createSuccessResponse(result.data);
  console.log("🟢 [ROUTE DEBUG] Final response:", {
    success: response.success,
    dataType: typeof response.data,
    dataIsArray: Array.isArray(response.data),
    dataLength: response.data?.length || 0,
    responseKeys: Object.keys(response),
  });

  return res.status(result.statusCode || 200).json(response);
});

/**
 * GET /api/whatsapp/offers/natural-language?query=סיטי נגד יונייטד&date=2026-01-17
 * Search for offers by natural language query
 * Supports query parameters for easier testing
 */
router.get("/offers/natural-language", async (req, res) => {
  const { query, date } = req.query;
  const result = await whatsAppSearchService.searchGame(query, date);

  if (!result.success) {
    const errorResponse = createErrorResponse(
      result.error?.code || "INTERNAL_SERVER_ERROR",
      result.error?.message || result.error
    );
    if (result.suggestions) {
      errorResponse.error.suggestions = result.suggestions;
    }
    return res.status(result.statusCode || 500).json(errorResponse);
  }

  return res
    .status(result.statusCode || 200)
    .json(createSuccessResponse(result.data));
});

export default router;
