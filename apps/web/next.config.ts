import type { NextConfig } from "next";

// NEXT_PUBLIC_BASE_PATH is set by the GitHub Pages workflow ("/reconstruct"); empty for local dev.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const config: NextConfig = { reactStrictMode: true, output: "export", basePath, trailingSlash: true };
export default config;
