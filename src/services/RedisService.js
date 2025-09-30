import errorHandler from "./ErrorHandlerService.js";

/**
 * Redis Service for caching and session management
 */
class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxRetries = 3;
  }

  /**
   * Initialize Redis connection
   * @param {object} options - Redis connection options
   */
  async connect(options = {}) {
    try {
      // Try to import Redis (optional dependency)
      const { createClient } = await import("redis");

      const defaultOptions = {
        host: process.env.REDIS_HOST || "localhost",
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        ...options,
      };

      this.client = createClient({
        socket: {
          host: defaultOptions.host,
          port: defaultOptions.port,
        },
        password: defaultOptions.password,
        database: defaultOptions.db,
      });

      // Set up event listeners
      this.setupEventListeners();

      // Connect to Redis
      await this.client.connect();

      errorHandler.logSuccess("Redis connected successfully", "REDIS_001", {
        host: defaultOptions.host,
        port: defaultOptions.port,
      });
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "connectRedis",
        severity: "warning",
        retryable: true,
      });

      // Redis is optional - continue without it
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Set up Redis event listeners
   */
  setupEventListeners() {
    if (!this.client) return;

    this.client.on("connect", () => {
      this.isConnected = true;
      errorHandler.logSuccess("Redis connection established", "REDIS_002");
    });

    this.client.on("ready", () => {
      this.isConnected = true;
      errorHandler.logSuccess("Redis is ready", "REDIS_003");
    });

    this.client.on("error", (error) => {
      this.isConnected = false;
      errorHandler.handleError(error, {
        operation: "redisError",
        severity: "warning",
        retryable: true,
      });
    });

    this.client.on("end", () => {
      this.isConnected = false;
      errorHandler.logWarning("Redis connection ended", "REDIS_004");
    });

    this.client.on("reconnecting", () => {
      errorHandler.logWarning("Redis reconnecting", "REDIS_005");
    });
  }

  /**
   * Check if Redis is available
   * @returns {boolean}
   */
  isAvailable() {
    return this.client && this.isConnected;
  }

  /**
   * Get value from Redis
   * @param {string} key - Cache key
   * @returns {Promise<string|null>} Cached value
   */
  async get(key) {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      return await this.client.get(key);
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "redisGet",
        severity: "warning",
        retryable: true,
      });
      return null;
    }
  }

  /**
   * Set value in Redis
   * @param {string} key - Cache key
   * @param {string} value - Value to cache
   * @param {number} expiry - Expiry time in seconds
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, expiry = null) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      if (expiry) {
        await this.client.setEx(key, expiry, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "redisSet",
        severity: "warning",
        retryable: true,
      });
      return false;
    }
  }

  /**
   * Delete key from Redis
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  async del(key) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "redisDel",
        severity: "warning",
        retryable: true,
      });
      return false;
    }
  }

  /**
   * Get multiple keys from Redis
   * @param {string} pattern - Key pattern
   * @returns {Promise<array>} Array of keys
   */
  async keys(pattern) {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "redisKeys",
        severity: "warning",
        retryable: true,
      });
      return [];
    }
  }

  /**
   * Delete multiple keys from Redis
   * @param {...string} keys - Keys to delete
   * @returns {Promise<boolean>} Success status
   */
  async delMultiple(...keys) {
    if (!this.isAvailable() || keys.length === 0) {
      return false;
    }

    try {
      await this.client.del(...keys);
      return true;
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "redisDelMultiple",
        severity: "warning",
        retryable: true,
      });
      return false;
    }
  }

  /**
   * Get Redis info
   * @returns {Promise<object>} Redis info
   */
  async info() {
    if (!this.isAvailable()) {
      return { connected: false, error: "Redis not available" };
    }

    try {
      const info = await this.client.info();
      return {
        connected: true,
        info: info,
      };
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "redisInfo",
        severity: "warning",
        retryable: true,
      });
      return { connected: false, error: error.message };
    }
  }

  /**
   * Gracefully disconnect from Redis
   */
  async disconnect() {
    if (!this.client) return;

    try {
      await this.client.quit();
      this.isConnected = false;
      errorHandler.logSuccess("Redis disconnected gracefully", "REDIS_006");
    } catch (error) {
      errorHandler.handleError(error, {
        operation: "disconnectRedis",
        severity: "warning",
        retryable: false,
      });
    }
  }

  /**
   * Get connection status
   * @returns {object} Connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      available: this.isAvailable(),
      client: !!this.client,
    };
  }
}

// Create singleton instance
const redisService = new RedisService();

export default redisService;
