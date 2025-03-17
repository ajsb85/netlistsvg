// eslint.config.js
import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.ts", "**/*.js"], // Apply to both TypeScript and JavaScript files
    ignores: ["built/**", "coverage/**", "node_modules/**", "examples/**", "jsmodule/**", "demo/**"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2017, // Adjust as needed for your project
        sourceType: "module",
        project: "./tsconfig.json", // Path to your tsconfig.json
      },
    },
    plugins: {
        "@typescript-eslint": typescriptEslint,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...typescriptEslint.configs.recommended.rules, // Add recommended TypeScript rules

      // Customize rules (based on your .eslintrc.yml and preferences)
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "off", // Consider enabling this later
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-cond-assign": "off",
      "no-constant-condition": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-prototype-builtins": "off", // Consider enabling this later
      "no-undef": "off",  // TypeScript handles this
      "no-useless-escape": "off",
    },
  },
];