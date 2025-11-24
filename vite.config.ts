import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname, "src"),

  // explicitly tell Vite where 'public' lives
  publicDir: path.resolve(__dirname, "public"),

  build: {
    // output to repo root/dist
    outDir: path.resolve(__dirname, "src/dist"),
    emptyOutDir: true,
  },
});
