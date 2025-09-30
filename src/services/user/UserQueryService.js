import User from "../../models/User.js";
import { logWithCheckpoint, logError } from "../../utils/logger.js";

class UserQueryService {
  // Get all users with pagination and filtering
  async getAllUsers(query = {}) {
    try {
      logWithCheckpoint("info", "Starting to fetch all users", "USER_001", {
        query,
      });

      const {
        page = 1,
        limit = 20,
        role,
        isActive,
        search,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = query;

      // Build filter object
      const filter = {};

      if (role) {
        filter.role = role;
        logWithCheckpoint("debug", "Added role filter", "USER_002", {
          role,
        });
      }

      if (isActive !== undefined) {
        filter.isActive = isActive === "true";
        logWithCheckpoint("debug", "Added isActive filter", "USER_003", {
          isActive: filter.isActive,
        });
      }

      if (search) {
        filter.$or = [{ whatsapp: { $regex: search, $options: "i" } }];
        logWithCheckpoint("debug", "Added search filter", "USER_004", {
          search,
        });
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === "desc" ? -1 : 1;

      const skip = (page - 1) * limit;

      logWithCheckpoint("info", "Executing database query", "USER_005", {
        filter,
        sort,
        skip,
        limit,
      });

      const [users, total] = await Promise.all([
        User.find(filter)
          .populate("agentId", "name whatsapp isActive")
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        User.countDocuments(filter),
      ]);

      logWithCheckpoint("info", "Successfully fetched users", "USER_006", {
        count: users.length,
        total,
      });

      return {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logError(error, { operation: "getAllUsers", query });
      throw error;
    }
  }

  // Get user by ID
  async getUserById(id) {
    try {
      logWithCheckpoint("info", "Starting to fetch user by ID", "USER_007", {
        id,
      });

      const user = await User.findById(id)
        .populate("agentId", "name whatsapp isActive")
        .lean();

      if (!user) {
        logWithCheckpoint("warn", "User not found", "USER_008", { id });
        return null;
      }

      logWithCheckpoint("info", "Successfully fetched user", "USER_009", {
        id,
      });
      return user;
    } catch (error) {
      logError(error, { operation: "getUserById", id });
      throw error;
    }
  }

  // Get user by WhatsApp number
  async getUserByWhatsApp(whatsapp) {
    try {
      logWithCheckpoint(
        "info",
        "Starting to fetch user by WhatsApp",
        "USER_010",
        {
          whatsapp,
        }
      );

      const user = await User.findOne({ whatsapp })
        .populate("agentId", "name whatsapp isActive")
        .lean();

      if (!user) {
        logWithCheckpoint("warn", "User not found by WhatsApp", "USER_011", {
          whatsapp,
        });
        return null;
      }

      logWithCheckpoint(
        "info",
        "Successfully fetched user by WhatsApp",
        "USER_012",
        {
          whatsapp,
        }
      );
      return user;
    } catch (error) {
      logError(error, { operation: "getUserByWhatsApp", whatsapp });
      throw error;
    }
  }

  // Get active users only
  async getActiveUsers() {
    try {
      logWithCheckpoint("info", "Starting to fetch active users", "USER_030");

      const users = await User.find({ isActive: true })
        .populate("agentId", "name whatsapp isActive")
        .sort({ createdAt: -1 })
        .lean();

      logWithCheckpoint(
        "info",
        "Successfully fetched active users",
        "USER_031",
        {
          count: users.length,
        }
      );

      return users;
    } catch (error) {
      logError(error, { operation: "getActiveUsers" });
      throw error;
    }
  }

  // Helper: Get user with agent populated
  async getUserWithAgent(id) {
    try {
      const user = await User.findById(id)
        .populate("agentId", "name whatsapp isActive")
        .lean();

      return user;
    } catch (error) {
      logError(error, { operation: "getUserWithAgent", id });
      throw error;
    }
  }
}

export default new UserQueryService();
