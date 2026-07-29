const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const previewHost = "127.0.0.1";
const previewPort = 4174;

module.exports = async () => {
  if (process.env.SNAKE_BASE_URL) {
    return;
  }

  const { preview } = await import("vite");
  const previewServer = await preview({
    configFile: path.join(projectRoot, "vite.config.js"),
    root: projectRoot,
    preview: {
      host: previewHost,
      port: previewPort,
      strictPort: true,
    },
  });

  const address = previewServer.httpServer.address();

  if (
    !address ||
    typeof address === "string" ||
    address.address !== previewHost ||
    address.port !== previewPort
  ) {
    await previewServer.close();
    throw new Error(`Production preview did not bind to ${previewHost}:${previewPort}`);
  }

  previewServer.printUrls();

  return async () => {
    await previewServer.close();
  };
};
