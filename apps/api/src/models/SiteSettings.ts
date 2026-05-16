import mongoose, { Schema } from "mongoose";

const AnnouncementBarSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    codText: { type: String, default: "Full Cash on Delivery" },
    deliveryText: { type: String, default: "Free Delivery All Over Bangladesh" },
    offerText: { type: String, default: "Offer ends in" },
  },
  { _id: false },
);

const BannerSchema = new Schema(
  {
    imageUrl: { type: String, default: "" },
    publicId: { type: String, default: "" },
  },
  { _id: false },
);

const SiteSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    shopBanner: { type: BannerSchema, default: () => ({}) },
    announcementBar: { type: AnnouncementBarSchema, default: () => ({}) },
  },
  { timestamps: true },
);

export const SiteSettingsModel =
  mongoose.models.SiteSettings ??
  mongoose.model("SiteSettings", SiteSettingsSchema);
