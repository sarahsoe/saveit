import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true
  },
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk']
  },
  // Configure body parser for file uploads
  api: {
    bodyParser: {
      sizeLimit: '50mb'
    }
  },
  // For app directory (route handlers)
  serverRuntimeConfig: {
    maxRequestSize: '50mb'
  }
};

export default nextConfig;
