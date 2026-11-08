import { defineConfig } from "oxlint";
import { base } from "@niwoerner/oxlint-rules/configs";

export default defineConfig({
  extends: [base],
  ignorePatterns: ["**/node_modules/**", "**/dist/**"],
});
