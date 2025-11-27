import Supplier from "../../models/Supplier.js";
import { logWithCheckpoint, logError } from "../../utils/logger.js";

/**
 * Get all suppliers
 */
export async function getAllSuppliers({ isActive = null } = {}) {
    try {
        const query = {};
        if (isActive !== null) {
            query.isActive = isActive;
        }

        const suppliers = await Supplier.find(query)
            .sort({ priority: -1, name: 1 })
            .lean();

        logWithCheckpoint("info", "Fetched all suppliers", "SUPPLIER_001", {
            count: suppliers.length,
            isActive,
        });

        return {
            success: true,
            data: suppliers,
        };
    } catch (error) {
        logError(error, { operation: "getAllSuppliers" });
        return {
            success: false,
            error: "Failed to fetch suppliers",
            message: error.message,
        };
    }
}

/**
 * Get supplier by ID
 */
export async function getSupplierById(supplierId) {
    try {
        const supplier = await Supplier.findById(supplierId).lean();

        if (!supplier) {
            return {
                success: false,
                error: "Supplier not found",
            };
        }

        logWithCheckpoint("info", "Fetched supplier by ID", "SUPPLIER_002", {
            supplierId,
        });

        return {
            success: true,
            data: supplier,
        };
    } catch (error) {
        logError(error, { operation: "getSupplierById", supplierId });
        return {
            success: false,
            error: "Failed to fetch supplier",
            message: error.message,
        };
    }
}

/**
 * Get supplier by slug
 */
export async function getSupplierBySlug(slug) {
    try {
        const supplier = await Supplier.findOne({ slug }).lean();

        if (!supplier) {
            return {
                success: false,
                error: "Supplier not found",
            };
        }

        logWithCheckpoint("info", "Fetched supplier by slug", "SUPPLIER_003", {
            slug,
        });

        return {
            success: true,
            data: supplier,
        };
    } catch (error) {
        logError(error, { operation: "getSupplierBySlug", slug });
        return {
            success: false,
            error: "Failed to fetch supplier",
            message: error.message,
        };
    }
}

/**
 * Create new supplier
 */
export async function createSupplier(supplierData) {
    try {
        const supplier = new Supplier(supplierData);
        await supplier.save();

        logWithCheckpoint("info", "Created new supplier", "SUPPLIER_004", {
            supplierId: supplier._id.toString(),
            name: supplier.name,
        });

        return {
            success: true,
            data: supplier.toObject(),
        };
    } catch (error) {
        logError(error, { operation: "createSupplier", supplierData });
        return {
            success: false,
            error: "Failed to create supplier",
            message: error.message,
        };
    }
}

/**
 * Update supplier
 */
export async function updateSupplier(supplierId, updateData) {
    try {
        const supplier = await Supplier.findByIdAndUpdate(
            supplierId,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!supplier) {
            return {
                success: false,
                error: "Supplier not found",
            };
        }

        logWithCheckpoint("info", "Updated supplier", "SUPPLIER_005", {
            supplierId,
        });

        return {
            success: true,
            data: supplier.toObject(),
        };
    } catch (error) {
        logError(error, { operation: "updateSupplier", supplierId, updateData });
        return {
            success: false,
            error: "Failed to update supplier",
            message: error.message,
        };
    }
}

/**
 * Delete supplier
 */
export async function deleteSupplier(supplierId) {
    try {
        const supplier = await Supplier.findByIdAndDelete(supplierId);

        if (!supplier) {
            return {
                success: false,
                error: "Supplier not found",
            };
        }

        logWithCheckpoint("info", "Deleted supplier", "SUPPLIER_006", {
            supplierId,
            name: supplier.name,
        });

        return {
            success: true,
            data: { message: "Supplier deleted successfully" },
        };
    } catch (error) {
        logError(error, { operation: "deleteSupplier", supplierId });
        return {
            success: false,
            error: "Failed to delete supplier",
            message: error.message,
        };
    }
}

/**
 * Get active suppliers
 */
export async function getActiveSuppliers() {
    try {
        const suppliers = await Supplier.getActiveSuppliers();

        logWithCheckpoint("info", "Fetched active suppliers", "SUPPLIER_007", {
            count: suppliers.length,
        });

        return {
            success: true,
            data: suppliers,
        };
    } catch (error) {
        logError(error, { operation: "getActiveSuppliers" });
        return {
            success: false,
            error: "Failed to fetch active suppliers",
            message: error.message,
        };
    }
}

/**
 * Get suppliers by type
 */
export async function getSuppliersByType(type) {
    try {
        const suppliers = await Supplier.getSuppliersByType(type);

        logWithCheckpoint("info", "Fetched suppliers by type", "SUPPLIER_008", {
            type,
            count: suppliers.length,
        });

        return {
            success: true,
            data: suppliers,
        };
    } catch (error) {
        logError(error, { operation: "getSuppliersByType", type });
        return {
            success: false,
            error: "Failed to fetch suppliers by type",
            message: error.message,
        };
    }
}
