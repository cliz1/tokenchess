// vite.config.ts
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  // change 'src' if your index.html lives somewhere else
  root: path.resolve(__dirname, "src"),

  build: {
    // output to repo root/dist
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true
  }
});