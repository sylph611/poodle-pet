import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { outDir: "out/main" }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "out/preload",
      rollupOptions: { output: { format: "cjs", entryFileNames: "[name].js" } }
    }
  },
  renderer: {
    root: "src/renderer",
    build: {
      outDir: "out/renderer",
      rollupOptions: {
        input: {
          pet: resolve(__dirname, "src/renderer/pet/index.html"),
          bubble: resolve(__dirname, "src/renderer/bubble/index.html"),
          memo: resolve(__dirname, "src/renderer/memo/index.html"),
          launcher: resolve(__dirname, "src/renderer/launcher/index.html"),
          settings: resolve(__dirname, "src/renderer/settings/index.html"),
          info: resolve(__dirname, "src/renderer/info/index.html")
        }
      }
    }
  }
});
