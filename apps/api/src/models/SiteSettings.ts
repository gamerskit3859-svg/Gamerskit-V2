import mongoose, { Schema } from "mongoose";

const BannerSchema = new Schema(
  {
    imageUrl: { type: String, default: "" },
    publicId: { type: String, default: "" },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const SiteSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    shopBanners: { type: [BannerSchema], default: [] },
  },
  { timestamps: true },
);

SiteSettingsSchema.index({ "shopBanners.isActive": 1, "shopBanners.order": 1 });

export const SiteSettingsModel =
  mongoose.models.SiteSettings ??
  mongoose.model("SiteSettings", SiteSettingsSchema);
