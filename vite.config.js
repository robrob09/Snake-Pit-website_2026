const { resolve } = require("node:path");

module.exports = {
  appType: "mpa",

  build: {
    // Keep the small leadership WebP assets as standalone production files.
    // This preserves the theme-assets URL contract and avoids embedding either avatar in the main bundle.
    assetsInlineLimit: 2048,

    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        news: resolve(__dirname, "news.html"),
        developments: resolve(__dirname, "developments.html"),
        disclaimer: resolve(__dirname, "disclaimer.html"),
      },
    },
  },
};
