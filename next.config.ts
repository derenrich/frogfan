import type { NextConfig } from "next";

const basePath = process.env.BASE_PATH || '/frogfan';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['fluent-ffmpeg', 'ffmpeg-static', 'ffprobe-static'],
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  outputFileTracingExcludes: {
    '*': [
      'venv/**/*',
      '.venv/**/*',
      'data/**/*'
    ]
  }
};

export default nextConfig;
