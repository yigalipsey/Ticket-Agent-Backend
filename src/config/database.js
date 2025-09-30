import mongoose from "mongoose";
import { logWithCheckpoint, logError } from "../utils/logger.js";
import errorHandler from "../services/ErrorHandlerService.js";
import retryService from "../services/RetryService.js";
import {
  ConnectionError,
  NetworkError,
  TimeoutError,
} from "../utils/DatabaseError.js";

/**
 * Database connection configuration and management
 */
class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.connection = null;
  }

  /**
   * Connect to MongoDB database
   * @param {string} uri - MongoDB connection URI
   * @returns {Promise<boolean>} - Connection success status
   */
  async connect(uri) {
    try {
      logWithCheckpoint("info", "Connecting to MongoDB", "DB_001", {
        uri: uri,
      });

      // Use retry service for connection
      this.connection = await retryService.executeWithRetry(
        () =>
          mongoose.connect(uri, {
            // Connection options
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            bufferCommands: false,
          }),
        {
          maxRetries: 3,
          baseDelay: 2000,
          maxDelay: 10000,
        },
        {
          operation: "connectToDatabase",
          uri: uri,
        }
      );

      this.isConnected = true;

      errorHandler.logSuccess("Successfully connected to MongoDB", "DB_002", {
        uri: uri,
      });

      // Set up connection event listeners
      this.setupEventListeners();

      return true;
    } catch (error) {
      // Handle different types of connection errors
      const enhancedError = this.categorizeConnectionError(error);

      errorHandler.handleDatabaseError(enhancedError, {
        operation: "connectToDatabase",
        uri: uri,
        retryable: enhancedError.isRetryable(),
      });

      this.isConnected = false;
      return false;
    }
  }

  /**
   * Categorize connection error by type
   * @param {Error} error - Original error
   * @returns {DatabaseError} Categorized error
   */
  categorizeConnectionError(error) {
    if (error.name === "MongoNetworkError" || error.code === "ENOTFOUND") {
      return new NetworkError(error.message, {
        operation: "connectToDatabase",
        context: { originalError: error },
      });
    }

    if (error.name === "MongoTimeoutError" || error.code === "ETIMEDOUT") {
      return new TimeoutError(error.message, {
        operation: "connectToDatabase",
        context: { originalError: error },
      });
    }

    return new ConnectionError(error.message, {
      operation: "connectToDatabase",
      context: { originalError: error },
    });
  }

  /**
   * Set up MongoDB connection event listeners
   */
  setupEventListeners() {
    mongoose.connection.on("connected", () => {
      errorHandler.logSuccess("MongoDB connected", "DB_003");
      this.isConnected = true;
    });

    mongoose.connection.on("error", (error) => {
      errorHandler.handleDatabaseError(error, {
        operation: "mongooseConnectionError",
        severity: "error",
        retryable: true,
      });
      this.isConnected = false;
    });

    mongoose.connection.on("disconnected", () => {
      errorHandler.logWarning("MongoDB disconnected", "DB_004");
      this.isConnected = false;
    });

    mongoose.connection.on("reconnected", () => {
      errorHandler.logSuccess("MongoDB reconnected", "DB_005");
      this.isConnected = true;
    });
  }

  /**
   * Check if database is connected
   * @returns {boolean} - Connection status
   */
  isDatabaseConnected() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * Get connection status information
   * @returns {object} - Connection status details
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name,
    };
  }

  /**
   * Gracefully disconnect from database
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this.connection) {
        await retryService.executeWithRetry(
          () => mongoose.disconnect(),
          { maxRetries: 2, baseDelay: 1000 },
          { operation: "disconnectDatabase" }
        );
        errorHandler.logSuccess("Database connection closed", "DB_006");
        this.isConnected = false;
      }
    } catch (error) {
      errorHandler.handleDatabaseError(error, {
        operation: "disconnectDatabase",
        severity: "warning",
        retryable: false,
      });
    }
  }

  /**
   * Reconnect to database
   * @param {string} uri - MongoDB connection URI
   * @returns {Promise<boolean>} - Reconnection success status
   */
  async reconnect(uri) {
    try {
      if (this.isConnected) {
        await this.disconnect();
      }
      return await this.connect(uri);
    } catch (error) {
      errorHandler.handleDatabaseError(error, {
        operation: "reconnectDatabase",
        severity: "error",
        retryable: true,
      });
      return false;
    }
  }
}

// Create singleton instance
const databaseConnection = new DatabaseConnection();

export default databaseConnection;
