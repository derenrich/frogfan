import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['fluent-ffmpeg', 'ffmpeg-static', 'ffprobe-static'],
};

export default nextConfig;
