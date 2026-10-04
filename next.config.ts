import type { NextConfig } from "next";

// GitHub Pages deploy theo sub-path /<repo> — set NEXT_PUBLIC_BASE_PATH khi build
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
