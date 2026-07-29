const { defineConfig, devices } = require("@playwright/test");

const externalBaseURL = process.env.SNAKE_BASE_URL;
const productionBaseURL = "http://127.0.0.1:4174";
const baseURL = externalBaseURL || productionBaseURL;

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  // Keep preview in this process: webServer teardown depends on taskkill on Windows.
  globalSetup: require.resolve("./tests/production-preview.setup.js"),
  use: {
    ...devices["Pixel 7"],
    baseURL,
    channel: "chrome",
    trace: "retain-on-failure",
  },
});
