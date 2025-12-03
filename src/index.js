import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import dotenv from "dotenv";
import databaseConnection from "./config/database.js";
// Session middleware removed - using JWT tokens directly

// Import routes
import fixturesRoutes from "./routes/fixtures.js";
import teamsRoutes from "./routes/teams.js";
import venuesRoutes from "./routes/venues.js";
import leaguesRoutes from "./routes/leagues.js";
import agentsRoutes from "./routes/agents.js";
import usersRoutes from "./routes/users.js";
import authRoutes from "./routes/auth.js";
import agentAuthRoutes from "./routes/agentAuth.js";
import offersRoutes from "./routes/offers/index.js";
import cacheRoutes from "./routes/cache.js";
import searchRoutes from "./routes/search.js";

// Import utilities
import logger, {
  logWithCheckpoint,
  logError,
  logRequest,
} from "./utils/logger.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Security middleware - Helmet.js
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow embedding from frontend
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin requests
  })
);

// CORS middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true, // Allow cookies
  })
);
// Print important envs for cookie/cors diagnostics
logWithCheckpoint("info", "Environment configuration loaded", "ENV_CHECK_001", {
  NODE_ENV: process.env.NODE_ENV,
  FRONTEND_URL: process.env.FRONTEND_URL,
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || "(unset)",
});
// Session middleware removed - JWT tokens handled in routes
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const responseTime = Date.now() - start;
    logRequest(req, res, responseTime);
  });

  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  const dbStatus = databaseConnection.getConnectionStatus();

  res.json({
    success: true,
    message: "Ticket Agent API is running",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
    database: {
      status: dbStatus.isConnected ? "connected" : "disconnected",
      readyState: dbStatus.readyState,
      host: dbStatus.host,
      name: dbStatus.name,
    },
  });
});

// Database connection middleware (skip for health endpoint)
app.use((req, res, next) => {
  if (req.path === "/health") {
    return next();
  }

  if (!databaseConnection.isDatabaseConnected()) {
    return res.status(503).json({
      success: false,
      error: "Database unavailable",
      message: "Database connection is not available. Please try again later.",
    });
  }
  next();
});

// API routes
app.use("/api/fixtures", fixturesRoutes); // Fixtures routes with cache
app.use("/api/teams", teamsRoutes);
app.use("/api/venues", venuesRoutes);
app.use("/api/leagues", leaguesRoutes);
app.use("/api/agents", agentsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/auth/agent", agentAuthRoutes); // Agent authentication routes
app.use("/api/offers", offersRoutes);
app.use("/api/cache", cacheRoutes); // Cache management routes
app.use("/api/search", searchRoutes); // Search routes

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use((error, req, res, next) => {
  logError(error, {
    method: req.method,
    url: req.url,
    body: req.body,
  });

  res.status(error.status || 500).json({
    success: false,
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong",
  });
});

// Connect to MongoDB
async function connectToDatabase() {
  try {
    const result = await databaseConnection.connect(process.env.MONGODB_URI);
    logWithCheckpoint("info", "Database connection result", "DB_CONNECT_001", { result });
    return result;
  } catch (error) {
    logError(error, { operation: "connectToDatabase" });
    return false;
  }
}

// Start server
async function startServer() {
  try {
    // Connect to database first
    await connectToDatabase();

    // Redis removed - working directly with database

    // Start HTTP server
    app.listen(PORT, () => {
      logWithCheckpoint("info", "Server started successfully", "SERVER_003", {
        port: PORT,
        environment: process.env.NODE_ENV || "development",
        healthCheck: `http://localhost:${PORT}/health`,
      });
    });
  } catch (error) {
    logError(error, { operation: "startServer" });
    process.exit(1);
  }
}

// Handle process termination
process.on("SIGINT", async () => {
  logWithCheckpoint(
    "info",
    "Received SIGINT, shutting down gracefully",
    "SERVER_004"
  );

  try {
    await databaseConnection.disconnect();
    process.exit(0);
  } catch (error) {
    logError(error, { operation: "gracefulShutdown" });
    process.exit(1);
  }
});

process.on("SIGTERM", async () => {
  logWithCheckpoint(
    "info",
    "Received SIGTERM, shutting down gracefully",
    "SERVER_006"
  );

  try {
    await databaseConnection.disconnect();
    process.exit(0);
  } catch (error) {
    logError(error, { operation: "gracefulShutdown" });
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logError(error, { operation: "uncaughtException" });
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logError(new Error(`Unhandled Rejection at: ${promise}, reason: ${reason}`), {
    operation: "unhandledRejection",
  });
  process.exit(1);
});

// Start the server
startServer();
