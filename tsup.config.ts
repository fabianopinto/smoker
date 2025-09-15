import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts", "features/step_definitions/**/*.ts"],
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
