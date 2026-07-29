const { expect, test } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const distDir = path.resolve(__dirname, "..", "dist");

const findFilesNamed = async (directory, name) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const matches = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return findFilesNamed(entryPath, name);
      }

      return entry.isFile() && entry.name === name ? [entryPath] : [];
    })
  );

  return matches.flat();
};

const pages = [
  {
    path: "/index.html",
    canonical: "https://snakepit.ru/",
    title: "Змеиное логово",
    description: "Информационный сайт клана «Змеиное логово» проекта «Мафия онлайн».",
    marker: {
      selector: "#hero-title",
      text: "Привет!",
    },
  },
  {
    path: "/news.html",
    canonical: "https://snakepit.ru/news.html",
    title: "Новости | Змеиное логово",
    description: "Новости клана «Змеиное логово» проекта «Мафия онлайн».",
    marker: {
      selector: "#news-title",
      text: "Новости",
    },
  },
  {
    path: "/developments.html",
    canonical: "https://snakepit.ru/developments.html",
    title: "Наши разработки | Змеиное логово",
    description: "Раздел будущих разработок клана «Змеиное логово».",
    marker: {
      selector: "main h1",
      text: "Наши разработки",
    },
  },
  {
    path: "/disclaimer.html",
    canonical: "https://snakepit.ru/disclaimer.html",
    title: "Отказ от ответственности | Змеиное логово",
    description: "Отказ от ответственности сайта клана «Змеиное логово».",
    marker: {
      selector: "#disclaimer-title",
      text: "Отказ от ответственности",
    },
  },
];

const socialImageUrl = "https://snakepit.ru/social-image.png";

const expectMeta = async (page, selector, content) => {
  const meta = page.locator(selector);
  await expect(meta).toHaveCount(1);
  await expect(meta).toHaveAttribute("content", content);
};

test("production artifact contains one valid CNAME file", async () => {
  const cnameFiles = await findFilesNamed(distDir, "CNAME");

  expect(cnameFiles).toHaveLength(1);
  expect((await fs.readFile(cnameFiles[0], "utf8")).trim()).toBe("snakepit.ru");
});

test("production routes serve their own pages and unknown HTML returns 404", async ({
  page,
  request,
}) => {
  for (const pageData of pages) {
    const response = await page.goto(pageData.path, { waitUntil: "load" });

    expect(response, pageData.path).not.toBeNull();
    expect(response.status(), pageData.path).toBe(200);
    await expect(page.locator(pageData.marker.selector)).toHaveText(pageData.marker.text);
  }

  const missingResponse = await request.get("/missing-acceptance-page.html");
  const missingBody = await missingResponse.text();

  expect(missingResponse.status()).toBe(404);
  expect(missingBody).not.toContain(`id="hero-title"`);
  expect(missingBody).not.toContain(`<title>${pages[0].title}</title>`);
});

test("production SEO metadata is complete on every page", async ({ page }) => {
  for (const pageData of pages) {
    await page.goto(pageData.path, { waitUntil: "load" });

    await expect(page.locator("link[rel='canonical']")).toHaveCount(1);
    await expect(page.locator("link[rel='canonical']")).toHaveAttribute(
      "href",
      pageData.canonical
    );
    await expect(page.locator("meta[name='twitter:site']")).toHaveCount(0);

    await expectMeta(page, "meta[property='og:locale']", "ru_RU");
    await expectMeta(page, "meta[property='og:type']", "website");
    await expectMeta(page, "meta[property='og:site_name']", "Змеиное логово");
    await expectMeta(page, "meta[property='og:title']", pageData.title);
    await expectMeta(page, "meta[property='og:description']", pageData.description);
    await expectMeta(page, "meta[property='og:url']", pageData.canonical);
    await expectMeta(page, "meta[property='og:image']", socialImageUrl);
    await expectMeta(page, "meta[name='twitter:card']", "summary_large_image");
    await expectMeta(page, "meta[name='twitter:title']", pageData.title);
    await expectMeta(page, "meta[name='twitter:description']", pageData.description);
    await expectMeta(page, "meta[name='twitter:image']", socialImageUrl);
  }
});

test("production service files and social image are served without HTML fallback", async ({
  request,
}) => {
  const serviceFiles = ["/CNAME", "/robots.txt", "/sitemap.xml"];

  for (const path of serviceFiles) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    const body = await response.text();
    expect(body.toLowerCase(), path).not.toContain("<html");
    expect(body.toLowerCase(), path).not.toContain("<!doctype html");
  }

  const cname = await request.get("/CNAME");
  expect((await cname.text()).trim()).toBe("snakepit.ru");

  const robots = await request.get("/robots.txt");
  const robotsText = await robots.text();
  expect(robotsText).toContain("User-agent: *");
  expect(robotsText).toContain("Disallow:");
  expect(robotsText).toContain("Sitemap: https://snakepit.ru/sitemap.xml");

  const sitemap = await request.get("/sitemap.xml");
  const sitemapUrls = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    ([, url]) => url
  );
  expect(sitemapUrls).toEqual([
    "https://snakepit.ru/",
    "https://snakepit.ru/news.html",
    "https://snakepit.ru/developments.html",
    "https://snakepit.ru/disclaimer.html",
  ]);

  const socialImage = await request.get("/social-image.png");
  expect(socialImage.status()).toBe(200);
  expect(socialImage.headers()["content-type"]).toContain("image/png");
  expect((await socialImage.body()).length).toBeGreaterThan(0);
});
