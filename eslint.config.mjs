import { defineConfig, globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  globalIgnores([
      "node_modules/**",
      ".next/**",
      ".vercel/**",
      "out/**",
      "build/**",
      "coverage/**",
      "test-results/**",
      "next-env.d.ts",
      "public/sw.js",
      "public/sw.js.map",
      "public/workbox-*.js",
      "workspace/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
]);

export default eslintConfig;
