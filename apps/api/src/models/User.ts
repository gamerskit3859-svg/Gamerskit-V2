import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: "" },
    phone: { type: String },
    passwordHash: { type: String }, // Optional for OAuth users
    avatar: { type: String, default: "" }, // For OAuth avatars
    googleId: { type: String, unique: true, sparse: true }, // Google OAuth ID
    facebookId: { type: String, unique: true, sparse: true }, // Facebook OAuth ID
    role: {
      type: String,
      enum: ["customer", "staff", "admin"],
      default: "customer",
      index: true,
    },
  },
  { timestamps: true },
);

export const UserModel =
  mongoose.models.User ?? mongoose.model("User", UserSchema);

export interface UserDocument {
  _id: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  passwordHash?: string;
  googleId?: string;
  facebookId?: string;
  role: "customer" | "staff" | "admin";
  createdAt: string;
  updatedAt: string;
}
