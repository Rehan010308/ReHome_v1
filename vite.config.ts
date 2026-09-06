import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ["@tensorflow/tfjs", "@tensorflow-models/coco-ssd"],
  },
  build: {
    rollupOptions: {
      output: {
        // The heavy libraries change far less often than the app does, so they
        // are split out to stay cached across deploys. Three and TensorFlow are
        // only reached through dynamic imports, so their chunks are still
        // fetched when the 3D stage or the detector is actually needed.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          three: ["three"],
        },
      },
    },
  },
});