import { optimizeGLTF } from "@iwsdk/vite-plugin-gltf-optimizer";
import { injectIWER } from "@iwsdk/vite-plugin-iwer";
import { compileUIKit } from "@iwsdk/vite-plugin-uikitml";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";

export default defineConfig({
  plugins: [
    mkcert(),
    injectIWER({
      device: "metaQuest3",
      activation: "localhost",
      verbose: true,
    }),
    compileUIKit({ sourceDir: "ui", outputDir: "public/ui", verbose: true }),
    optimizeGLTF({
      level: "medium",
    }),
  ],
  // CORRECT BASE URL for GitHub Pages:
  base: process.env.NODE_ENV === 'production' 
    ? '/alien-invasion/' 
    : '/',
  server: { 
    host: "0.0.0.0", 
    port: 8081, 
    open: true,
    // Enable CORS for development
    cors: true
  },
  build: {
    outDir: "dist",
    sourcemap: process.env.NODE_ENV !== "production",
    target: "esnext",
    rollupOptions: { 
      input: "./index.html",
      output: {
        // Ensure proper chunk naming for GitHub Pages
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
  },
  esbuild: { target: "esnext" },
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
    esbuildOptions: { target: "esnext" },
  },
  publicDir: "public",
});