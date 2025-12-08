import express from "express";
import whatsAppSearchService from "../services/whatsapp/WhatsAppSearchService.js";
import { createErrorResponse } from "../utils/errorCodes.js";
import { createSuccessResponse } from "../utils/successCodes.js";

// ANSI color codes for colored console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

const logColor = (color, label, message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(
    `${colors.dim}[${timestamp}]${colors.reset} ${color}${colors.bright}${label}${colors.reset} ${color}${message}${colors.reset}`
  );
  if (data) {
    console.log(
      `${colors.dim}  Data:${colors.reset}`,
      JSON.stringify(data, null, 2)
    );
  }
};

const router = express.Router();

// Health check for WhatsApp routes
router.get("/health", (req, res) => {
  logColor(colors.green, "✅ [WHATSAPP HEALTH]", "Health check requested");
  res.json({
    success: true,
    message: "WhatsApp routes are working",
    timestamp: new Date().toISOString(),
  });
});

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
  console.log("\n" + colors.cyan + "=".repeat(80) + colors.reset);
  logColor(colors.cyan, "📥 [WHATSAPP ROUTE - POST]", "Request received", {
    url: req.url,
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    body: req.body,
    headers: {
      origin: req.headers.origin,
      "content-type": req.headers["content-type"],
      "user-agent": req.headers["user-agent"],
    },
  });

  const { query, date } = req.body;

  logColor(colors.yellow, "📋 [ROUTE - EXTRACT]", "Extracting parameters", {
    query: query,
    date: date,
    queryType: typeof query,
    dateType: typeof date,
  });

  if (!query) {
    logColor(
      colors.red,
      "❌ [ROUTE - VALIDATION]",
      "Missing required field: query"
    );
    const errorResponse = createErrorResponse("VALIDATION_MISSING_FIELDS", {
      required: ["query"],
      message: "Query is required",
    });
    return res.status(400).json(errorResponse);
  }

  logColor(
    colors.blue,
    "🚀 [ROUTE - SERVICE CALL]",
    "Calling WhatsAppSearchService.searchGame",
    { query, date }
  );

  const startTime = Date.now();
  const result = await whatsAppSearchService.searchGame(query, date);
  const duration = Date.now() - startTime;

  logColor(
    colors.blue,
    "⏱️ [ROUTE - SERVICE RESULT]",
    `Service completed in ${duration}ms`,
    {
      success: result.success,
      dataType: typeof result.data,
      dataIsArray: Array.isArray(result.data),
      dataLength: result.data?.length || 0,
      statusCode: result.statusCode,
      hasError: !!result.error,
      hasSuggestions: !!result.suggestions,
    }
  );

  if (!result.success) {
    logColor(colors.red, "❌ [ROUTE - ERROR]", "Service returned error", {
      errorCode: result.error?.code,
      errorMessage: result.error?.message || result.error,
      statusCode: result.statusCode || 500,
      suggestions: result.suggestions,
    });

    const errorResponse = createErrorResponse(
      result.error?.code || "INTERNAL_SERVER_ERROR",
      result.error?.message || result.error
    );
    if (result.suggestions) {
      errorResponse.error.suggestions = result.suggestions;
    }

    logColor(
      colors.red,
      "📤 [ROUTE - ERROR RESPONSE]",
      `Sending error response (${result.statusCode || 500})`,
      errorResponse
    );

    console.log(colors.red + "=".repeat(80) + colors.reset + "\n");
    return res.status(result.statusCode || 500).json(errorResponse);
  }

  logColor(colors.green, "✅ [ROUTE - SUCCESS]", "Service returned success", {
    dataLength: result.data?.length || 0,
    dataIsArray: Array.isArray(result.data),
    statusCode: result.statusCode || 200,
  });

  const response = createSuccessResponse(result.data);

  logColor(
    colors.green,
    "📤 [ROUTE - SUCCESS RESPONSE]",
    `Sending success response (${result.statusCode || 200})`,
    {
      success: response.success,
      dataType: typeof response.data,
      dataIsArray: Array.isArray(response.data),
      dataLength: response.data?.length || 0,
      responseKeys: Object.keys(response),
      code: response.code,
      message: response.message,
    }
  );

  console.log(colors.green + "=".repeat(80) + colors.reset + "\n");
  return res.status(result.statusCode || 200).json(response);
});

/**
 * GET /api/whatsapp/offers/natural-language?query=סיטי נגד יונייטד&date=2026-01-17
 * Search for offers by natural language query
 * Supports query parameters for easier testing
 */
router.get("/offers/natural-language", async (req, res) => {
  console.log("\n" + colors.cyan + "=".repeat(80) + colors.reset);
  logColor(colors.cyan, "📥 [WHATSAPP ROUTE - GET]", "Request received", {
    url: req.url,
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    query: req.query,
    headers: {
      origin: req.headers.origin,
      "user-agent": req.headers["user-agent"],
    },
  });

  const { query, date } = req.query;

  logColor(colors.yellow, "📋 [ROUTE - EXTRACT]", "Extracting parameters", {
    query: query,
    date: date,
    queryType: typeof query,
    dateType: typeof date,
  });

  if (!query) {
    logColor(
      colors.red,
      "❌ [ROUTE - VALIDATION]",
      "Missing required field: query"
    );
    const errorResponse = createErrorResponse("VALIDATION_MISSING_FIELDS", {
      required: ["query"],
      message: "Query is required",
    });
    console.log(colors.red + "=".repeat(80) + colors.reset + "\n");
    return res.status(400).json(errorResponse);
  }

  logColor(
    colors.blue,
    "🚀 [ROUTE - SERVICE CALL]",
    "Calling WhatsAppSearchService.searchGame",
    { query, date }
  );

  const startTime = Date.now();
  const result = await whatsAppSearchService.searchGame(query, date);
  const duration = Date.now() - startTime;

  logColor(
    colors.blue,
    "⏱️ [ROUTE - SERVICE RESULT]",
    `Service completed in ${duration}ms`,
    {
      success: result.success,
      dataType: typeof result.data,
      dataIsArray: Array.isArray(result.data),
      dataLength: result.data?.length || 0,
      statusCode: result.statusCode,
      hasError: !!result.error,
      hasSuggestions: !!result.suggestions,
    }
  );

  if (!result.success) {
    logColor(colors.red, "❌ [ROUTE - ERROR]", "Service returned error", {
      errorCode: result.error?.code,
      errorMessage: result.error?.message || result.error,
      statusCode: result.statusCode || 500,
      suggestions: result.suggestions,
    });

    const errorResponse = createErrorResponse(
      result.error?.code || "INTERNAL_SERVER_ERROR",
      result.error?.message || result.error
    );
    if (result.suggestions) {
      errorResponse.error.suggestions = result.suggestions;
    }

    logColor(
      colors.red,
      "📤 [ROUTE - ERROR RESPONSE]",
      `Sending error response (${result.statusCode || 500})`,
      errorResponse
    );

    console.log(colors.red + "=".repeat(80) + colors.reset + "\n");
    return res.status(result.statusCode || 500).json(errorResponse);
  }

  logColor(colors.green, "✅ [ROUTE - SUCCESS]", "Service returned success", {
    dataLength: result.data?.length || 0,
    dataIsArray: Array.isArray(result.data),
    statusCode: result.statusCode || 200,
  });

  const response = createSuccessResponse(result.data);

  logColor(
    colors.green,
    "📤 [ROUTE - SUCCESS RESPONSE]",
    `Sending success response (${result.statusCode || 200})`,
    {
      success: response.success,
      dataType: typeof response.data,
      dataIsArray: Array.isArray(response.data),
      dataLength: response.data?.length || 0,
      responseKeys: Object.keys(response),
      code: response.code,
      message: response.message,
    }
  );

  console.log(colors.green + "=".repeat(80) + colors.reset + "\n");
  return res.status(result.statusCode || 200).json(response);
});

export default router;
