import User from "../../models/User.js";
import Agent from "../../models/Agent.js";
import { logWithCheckpoint, logError } from "../../utils/logger.js";
import { ERROR_CODES } from "../../utils/errorCodes.js";

class UserMutationService {
  // Create new user
  async createUser(userData) {
    try {
      logWithCheckpoint("info", "Starting to create new user", "USER_013", {
        userData: {
          ...userData,
          passwordHash: userData.passwordHash ? "[HIDDEN]" : undefined,
        },
      });

      // Verify agent exists only if role is agent
      if (userData.role === "agent" && userData.agentId) {
        const agent = await Agent.findById(userData.agentId);
        if (!agent) {
          const error = new Error("Agent not found");
          error.code = "AGENT_NOT_FOUND";
          error.statusCode = 404;
          throw error;
        }
      }

      const user = new User(userData);
      const savedUser = await user.save();

      // Populate agent data
      const populatedUser = await User.findById(savedUser._id)
        .populate("agentId", "name whatsapp isActive")
        .lean();

      logWithCheckpoint("info", "Successfully created user", "USER_014", {
        id: savedUser._id,
      });

      return populatedUser;
    } catch (error) {
      logError(error, {
        operation: "createUser",
        userData: {
          ...userData,
          passwordHash: userData.passwordHash ? "[HIDDEN]" : undefined,
        },
      });
      throw error;
    }
  }

  // Update user
  async updateUser(id, updateData) {
    try {
      logWithCheckpoint("info", "Starting to update user", "USER_015", {
        id,
        updateData: {
          ...updateData,
          passwordHash: updateData.passwordHash ? "[HIDDEN]" : undefined,
        },
      });

      const user = await User.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      })
        .populate("agentId", "name whatsapp isActive")
        .lean();

      if (!user) {
        logWithCheckpoint("warn", "User not found for update", "USER_016", {
          id,
        });
        return null;
      }

      logWithCheckpoint("info", "Successfully updated user", "USER_017", {
        id,
      });
      return user;
    } catch (error) {
      logError(error, {
        operation: "updateUser",
        id,
        updateData: {
          ...updateData,
          passwordHash: updateData.passwordHash ? "[HIDDEN]" : undefined,
        },
      });
      throw error;
    }
  }

  // Deactivate user
  async deactivateUser(id) {
    try {
      logWithCheckpoint("info", "Starting to deactivate user", "USER_018", {
        id,
      });

      const user = await User.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true, runValidators: true }
      )
        .populate("agentId", "name whatsapp isActive")
        .lean();

      if (!user) {
        logWithCheckpoint(
          "warn",
          "User not found for deactivation",
          "USER_019",
          {
            id,
          }
        );
        return null;
      }

      logWithCheckpoint("info", "Successfully deactivated user", "USER_020", {
        id,
      });
      return user;
    } catch (error) {
      logError(error, { operation: "deactivateUser", id });
      throw error;
    }
  }

  // Activate user
  async activateUser(id) {
    try {
      logWithCheckpoint("info", "Starting to activate user", "USER_021", {
        id,
      });

      const user = await User.findByIdAndUpdate(
        id,
        { isActive: true },
        { new: true, runValidators: true }
      )
        .populate("agentId", "name whatsapp isActive")
        .lean();

      if (!user) {
        logWithCheckpoint("warn", "User not found for activation", "USER_022", {
          id,
        });
        return null;
      }

      logWithCheckpoint("info", "Successfully activated user", "USER_023", {
        id,
      });
      return user;
    } catch (error) {
      logError(error, { operation: "activateUser", id });
      throw error;
    }
  }
}

export default new UserMutationService();
