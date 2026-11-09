import mongoose, { Schema } from "mongoose";

const DemoVideoSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    video: {
      url: { type: String, required: true },
      key: { type: String, required: true }, // Cloudflare R2 object key, for deletion
    },
    // Admin-selected aspect ratio so the portfolio renders a consistent card
    // instead of guessing from the loaded video metadata. "portrait" = 9:16
    // shorts/reels, "landscape" = 16:9 wide videos.
    orientation: {
      type: String,
      enum: ["portrait", "landscape"],
      default: "portrait",
    },
    // Manual display order controlled by drag-and-drop in the admin. Lower
    // numbers show first on the portfolio site.
    order: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

// Listing is ordered by the manual `order`, falling back to newest-first for
// legacy documents that share the default order of 0.
DemoVideoSchema.index({ order: 1, createdAt: -1 });

export const DemoVideoModel =
  mongoose.models.DemoVideo ?? mongoose.model("DemoVideo", DemoVideoSchema);

export interface DemoVideoDocument {
  _id: string;
  title: string;
  video: {
    url: string;
    key: string;
  };
  orientation: "portrait" | "landscape";
  order: number;
  createdAt: string;
  updatedAt: string;
}
