import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "vite";

const copyDirectory = (from, to) => {
  if (!existsSync(from)) return;
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const source = join(from, entry);
    const target = join(to, entry);
    if (statSync(source).isDirectory()) copyDirectory(source, target);
    else copyFileSync(source, target);
  }
};

const copyRemotionAssets = () => ({
  name: "copy-remotion-assets",
  closeBundle() {
    copyDirectory("remotion-hero/out", "dist/remotion-hero/out");
  },
});

export default defineConfig({
  base: "./",
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET || "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: Number(process.env.PORT || 5173),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    minify: "esbuild",
    cssCodeSplit: true,
    assetsInlineLimit: 1024,
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  plugins: [copyRemotionAssets()],
});
