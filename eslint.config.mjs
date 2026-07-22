import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Library build output. Linting it re-reports every finding from src/ against
    // machine-generated JS, where the react-hooks rules misfire on the compiled
    // shape of code that is correct in the source.
    "dist/**",
  ]),
]);

export default eslintConfig;
