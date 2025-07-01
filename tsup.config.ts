import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "es2022",
  splitting: false,
  minify: true,
  treeshake: true,
  dts: true,
  sourcemap: true,
  clean: true,
  shims: true,
});
