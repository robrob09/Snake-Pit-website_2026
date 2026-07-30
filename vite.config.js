const { resolve } = require("node:path");

const inlineIndexStylesheet = () => ({
  name: "inline-index-stylesheet",
  enforce: "post",
  generateBundle(_options, bundle) {
    const indexAsset = bundle["index.html"];

    if (!indexAsset || indexAsset.type !== "asset") {
      return;
    }

    const html = String(indexAsset.source);
    const stylesheetMatch = html.match(
      /<link rel="stylesheet" crossorigin href="\/(assets\/main-[^"]+\.css)">/
    );

    if (!stylesheetMatch) {
      this.error("Could not find the main stylesheet in the production index.html.");
    }

    const stylesheetAsset = bundle[stylesheetMatch[1]];

    if (!stylesheetAsset || stylesheetAsset.type !== "asset") {
      this.error(`Could not find ${stylesheetMatch[1]} in the production bundle.`);
    }

    const stylesheet = String(stylesheetAsset.source).replace(/<\/style/gi, "<\\/style");
    indexAsset.source = html.replace(
      stylesheetMatch[0],
      `<style data-inline-index-styles>${stylesheet}</style>`
    );
  },
});

module.exports = {
  appType: "mpa",
  plugins: [inlineIndexStylesheet()],

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
