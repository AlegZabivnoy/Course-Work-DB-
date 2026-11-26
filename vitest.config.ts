import { defineConfig } from "vitest/config";
import { testUrl } from "./tests/test-db";

export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
        globalSetup: ["tests/global-setup.ts"],
        fileParallelism: false,
        env: { DATABASE_URL: testUrl },
    },
});