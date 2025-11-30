import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            unique: true,
        },
        type: {
            type: String,
            enum: ["tickets", "hotels", "packages", "transport", "other"],
            default: "tickets",
            required: true,
        },
        description: {
            type: String,
            trim: true,
            maxlength: 500,
        },
        imageUrl: {
            type: String,
            trim: true,
            validate: {
                validator: function (v) {
                    return !v || /^https?:\/\/.+/.test(v);
                },
                message: "Image URL must be a valid HTTP/HTTPS URL",
            },
        },
        websiteUrl: {
            type: String,
            trim: true,
            validate: {
                validator: function (v) {
                    return !v || /^https?:\/\/.+/.test(v);
                },
                message: "Website URL must be a valid HTTP/HTTPS URL",
            },
        },
        affiliateLinkBase: {
            type: String,
            trim: true,
            validate: {
                validator: function (v) {
                    return !v || /^https?:\/\/.+/.test(v);
                },
                message: "Affiliate link must be a valid HTTP/HTTPS URL",
            },
        },
        countries: [
            {
                type: String,
                trim: true,
                uppercase: true,
            },
        ],
        leagues: [
            {
                type: String,
                trim: true,
            },
        ],
        externalIds: {
            apiFootball: {
                type: Number,
                sparse: true,
            },
            internalCode: {
                type: String,
                trim: true,
                uppercase: true,
            },
        },
        contactInfo: {
            email: {
                type: String,
                trim: true,
                lowercase: true,
            },
            phone: {
                type: String,
                trim: true,
            },
            supportUrl: {
                type: String,
                trim: true,
            },
        },
        syncConfig: {
            enabled: {
                type: Boolean,
                default: false,
            },
            method: {
                type: String,
                enum: ["csv", "api", "webhook", "manual"],
                default: "manual",
            },
            schedule: {
                type: String,
                trim: true,
            },
            lastSyncAt: {
                type: Date,
            },
            nextSyncAt: {
                type: Date,
            },
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        priority: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        metadata: {
            type: Map,
            of: mongoose.Schema.Types.Mixed,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
supplierSchema.index({ slug: 1 }, { unique: true });
supplierSchema.index({ name: 1 });
supplierSchema.index({ type: 1 });
supplierSchema.index({ isActive: 1 });
supplierSchema.index({ countries: 1 });
supplierSchema.index({ leagues: 1 });
supplierSchema.index({ priority: -1 });

// Virtual for offers count (if needed later)
supplierSchema.virtual("offersCount", {
    ref: "Offer",
    localField: "_id",
    foreignField: "supplierId",
    count: true,
});

// Method to get public data (for API responses)
supplierSchema.methods.toPublicObject = function () {
    return {
        _id: this._id.toString(),
        name: this.name,
        slug: this.slug,
        type: this.type,
        description: this.description,
        imageUrl: this.imageUrl,
        websiteUrl: this.websiteUrl,
        countries: this.countries,
        leagues: this.leagues,
        isActive: this.isActive,
        priority: this.priority,
    };
};

// Static method to get active suppliers
supplierSchema.statics.getActiveSuppliers = function () {
    return this.find({ isActive: true }).sort({ priority: -1, name: 1 }).lean();
};

// Static method to get suppliers by type
supplierSchema.statics.getSuppliersByType = function (type) {
    return this.find({ isActive: true, type }).sort({ priority: -1, name: 1 }).lean();
};

const Supplier = mongoose.models.Supplier || mongoose.model("Supplier", supplierSchema);

export default Supplier;
