import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['fluent-ffmpeg', 'ffmpeg-static', 'ffprobe-static'],
  ...(process.env.BASE_PATH ? { basePath: process.env.BASE_PATH } : {}),
};

export default nextConfig;
