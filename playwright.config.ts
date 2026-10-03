import { defineConfig, } from "@playwright/test";

const TEST_SERVER_HOST = "127.0.0.1";
const TEST_SERVER_PORT = 3016;
const TEST_SERVER_URL = `http://${TEST_SERVER_HOST}:${TEST_SERVER_PORT}`;

export default defineConfig({
    testDir: "./test/browser",
    testMatch: "**/*_test.js",
    fullyParallel: true,
    workers: 2,
    projects: [
        {
            name: "chromium",
            use: {
                browserName: "chromium",
            },
        },
        {
            name: "firefox",
            use: {
                browserName: "firefox",
            },
        },
        {
            name: "webkit",
            use: {
                browserName: "webkit",
            },
        },
    ],
    use: {
        baseURL: TEST_SERVER_URL,
        viewport: {
            width: 1000,
            height: 900,
        },
        reducedMotion: "no-preference",
        trace: "retain-on-failure",
    },
    webServer: {
        command: `npx vite --host ${TEST_SERVER_HOST} --port ${TEST_SERVER_PORT} --strictPort`,
        url: TEST_SERVER_URL,
    },
},);
