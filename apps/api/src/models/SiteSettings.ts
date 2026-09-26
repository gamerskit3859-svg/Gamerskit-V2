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

// A "get in touch" destination shown in the storefront contact widget. The
// admin types a bare handle (a phone number, a username) and the public
// endpoint turns it into an href, so nobody has to hand-write wa.me URLs.
const ContactChannelSchema = new Schema(
  {
    // Drives the icon and colour, and how value becomes a link.
    type: {
      type: String,
      enum: [
        "whatsapp",
        "messenger",
        "telegram",
        "instagram",
        "phone",
        "email",
        "custom",
      ],
      default: "custom",
    },
    label: { type: String, default: "" },
    description: { type: String, default: "" },
    value: { type: String, default: "" },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const SiteSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    shopBanners: { type: [BannerSchema], default: [] },
    contactChannels: { type: [ContactChannelSchema], default: [] },
  },
  { timestamps: true },
);

SiteSettingsSchema.index({ "shopBanners.isActive": 1, "shopBanners.order": 1 });
SiteSettingsSchema.index({
  "contactChannels.isActive": 1,
  "contactChannels.order": 1,
});

export const SiteSettingsModel =
  mongoose.models.SiteSettings ??
  mongoose.model("SiteSettings", SiteSettingsSchema);
