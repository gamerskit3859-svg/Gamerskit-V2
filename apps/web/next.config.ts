import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // GamersKit currently hosts product images on ImageKit + ibb.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        port: "",
        pathname: "/dwyjqd89w/image/upload/**",
      },
      { protocol: "https", hostname: "ik.imagekit.io" },
      { protocol: "https", hostname: "i.ibb.co" },
      { protocol: "https", hostname: "i.ibb.co.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  transpilePackages: ["@gamerskit/shared"],
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
