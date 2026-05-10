import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['fluent-ffmpeg', 'ffmpeg-static', 'ffprobe-static'],
  basePath: process.env.BASE_PATH || '/frogfan',
};

export default nextConfig;
