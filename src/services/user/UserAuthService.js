import User from "../../models/User.js";
import { logWithCheckpoint, logError } from "../../utils/logger.js";

class UserAuthService {
  // Update last login
  async updateLastLogin(id) {
    try {
      logWithCheckpoint("info", "Starting to update last login", "USER_024", {
        id,
      });

      const user = await User.findByIdAndUpdate(
        id,
        { lastLoginAt: new Date() },
        { new: true, runValidators: true }
      )
        .populate("agentId", "name whatsapp isActive")
        .lean();

      if (!user) {
        logWithCheckpoint(
          "warn",
          "User not found for login update",
          "USER_025",
          {
            id,
          }
        );
        return null;
      }

      logWithCheckpoint("info", "Successfully updated last login", "USER_026", {
        id,
      });
      return user;
    } catch (error) {
      logError(error, { operation: "updateLastLogin", id });
      throw error;
    }
  }

  // Increment token version (for logout all devices)
  async incrementTokenVersion(id) {
    try {
      logWithCheckpoint(
        "info",
        "Starting to increment token version",
        "USER_027",
        {
          id,
        }
      );

      const user = await User.findByIdAndUpdate(
        id,
        { $inc: { tokenVersion: 1 } },
        { new: true, runValidators: true }
      )
        .populate("agentId", "name whatsapp isActive")
        .lean();

      if (!user) {
        logWithCheckpoint(
          "warn",
          "User not found for token version update",
          "USER_028",
          {
            id,
          }
        );
        return null;
      }

      logWithCheckpoint(
        "info",
        "Successfully incremented token version",
        "USER_029",
        {
          id,
          tokenVersion: user.tokenVersion,
        }
      );
      return user;
    } catch (error) {
      logError(error, { operation: "incrementTokenVersion", id });
      throw error;
    }
  }

  // Validate user credentials (for future use)
  async validateCredentials(whatsapp, passwordHash) {
    try {
      logWithCheckpoint(
        "info",
        "Starting to validate credentials",
        "USER_032",
        {
          whatsapp,
        }
      );

      const user = await User.findOne({
        whatsapp,
        passwordHash,
        isActive: true,
      })
        .populate("agentId", "name whatsapp isActive")
        .lean();

      if (!user) {
        logWithCheckpoint("warn", "Invalid credentials", "USER_033", {
          whatsapp,
        });
        return null;
      }

      logWithCheckpoint(
        "info",
        "Successfully validated credentials",
        "USER_034",
        {
          userId: user._id,
        }
      );
      return user;
    } catch (error) {
      logError(error, { operation: "validateCredentials", whatsapp });
      throw error;
    }
  }

  // Check if user is active
  async isUserActive(id) {
    try {
      const user = await User.findById(id).select("isActive").lean();
      return user ? user.isActive : false;
    } catch (error) {
      logError(error, { operation: "isUserActive", id });
      return false;
    }
  }

  // Get user token version
  async getUserTokenVersion(id) {
    try {
      const user = await User.findById(id).select("tokenVersion").lean();
      return user ? user.tokenVersion : 0;
    } catch (error) {
      logError(error, { operation: "getUserTokenVersion", id });
      return 0;
    }
  }
}

export default new UserAuthService();
