// @ts-check

import eslint from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import tseslint from "typescript-eslint";

export default tseslint.config({
  files: ["src/**/*.ts", "test/**/*.ts"],
  plugins: { vitest },
  extends: [
    eslint.configs.recommended,
    tseslint.configs.strict,
    tseslint.configs.stylistic,
    vitest.configs.recommended,
  ],
  languageOptions: {
    ecmaVersion: 2022,
  },
});
