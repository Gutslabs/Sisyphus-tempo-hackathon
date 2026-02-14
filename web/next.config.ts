import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Remove console.* from production bundles (client + server build output).
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  // Standalone: single deployable bundle with all API routes and deps traced (fixes /api/tempo/* 404 in production)
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  // Transpile ESM packages to ensure compatibility
  transpilePackages: ["wagmi", "viem", "porto", "ox", "@wagmi/core", "@wagmi/connectors"],
  webpack: (config, { webpack, isServer }) => {
    // Stub out optional wallet SDKs that wagmi connectors reference but we don't use.
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      // Base
      "@base-org/account": path.resolve(__dirname, "src/lib/empty-module.ts"),
      // Gemini
      "@gemini-wallet/core": path.resolve(__dirname, "src/lib/empty-module.ts"),
      // MetaMask
      "@metamask/sdk": path.resolve(__dirname, "src/lib/empty-module.ts"),
      // Safe apps
      "@safe-global/safe-apps-sdk": path.resolve(__dirname, "src/lib/empty-module.ts"),
      "@safe-global/safe-apps-provider": path.resolve(__dirname, "src/lib/empty-module.ts"),
      // WalletConnect is bundled by Privy, stub out root dependency if needed or let overrides handle it
    };

    // Add polyfills for Buffer and process which are often missing in browser builds for wallet SDKs.
    // ONLY apply this to the client build (!isServer), otherwise it breaks the server (pino/bigint error).
    if (!isServer) {
      config.plugins = [
        ...(config.plugins || []),
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        }),
      ];
    }

    return config;
  },
};

export default nextConfig;
