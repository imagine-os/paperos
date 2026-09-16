import { FlatCompat } from "@eslint/eslintrc";
import prettier from "eslint-config-prettier";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
      "tools/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  prettier,
  {
    // The 2025 prototype is frozen. Lint it, but do not fail on its habits.
    files: ["src/legacy/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@next/next/no-img-element": "off",
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
];

export default config;
