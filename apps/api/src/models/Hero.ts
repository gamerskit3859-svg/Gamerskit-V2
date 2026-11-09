import mongoose, { Schema } from "mongoose";

const HeroMediaSchema = new Schema(
  {
    type: { type: String, enum: ["image", "video"], required: true },
    url: { type: String, required: true },
    key: { type: String, required: true }, // Cloudflare R2 object key, for deletion
  },
  { _id: false },
);

/**
 * Hero section. Exactly one document may exist — the unique `key` enforces
 * that at the database level, so concurrent upserts can never race two
 * documents into existence. `media` is optional until the first upload.
 */
const HeroSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, required: true, trim: true },
    media: { type: HeroMediaSchema, default: undefined },
  },
  { timestamps: true },
);

export const HeroModel = mongoose.models.Hero ?? mongoose.model("Hero", HeroSchema);

export interface HeroDocument {
  _id: string;
  key: string;
  title: string;
  subtitle: string;
  media?: {
    type: "image" | "video";
    url: string;
    key: string;
  };
  createdAt: string;
  updatedAt: string;
}
