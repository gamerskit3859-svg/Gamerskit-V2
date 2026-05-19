import mongoose, { Schema } from "mongoose";

const HeroImageSchema = new Schema(
  {
    imageUrl: { type: String, required: true },
    mediaUrl: { type: String },
    mediaType: {
      type: String,
      enum: ["image", "video"],
      default: "image",
      index: true,
    },
    publicId: { type: String, required: true }, // Cloudinary public ID for deletion
    order: { type: Number, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    link: { type: String, default: "" },
  },
  { timestamps: true },
);

// Index for efficient querying of active images sorted by order
HeroImageSchema.index({ isActive: 1, order: 1 });

export const HeroImageModel =
  mongoose.models.HeroImage ?? mongoose.model("HeroImage", HeroImageSchema);

export interface HeroImageDocument {
  _id: string;
  imageUrl: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  publicId: string;
  order: number;
  isActive: boolean;
  title: string;
  subtitle: string;
  link: string;
  createdAt: string;
  updatedAt: string;
}
