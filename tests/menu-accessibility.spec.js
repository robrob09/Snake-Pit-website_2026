const { expect, test } = require("@playwright/test");
const { AxeBuilder } = require("@axe-core/playwright");

const openMenu = async (page) => {
  const toggle = page.locator(".menu-toggle");
  await expect(toggle).toHaveAccessibleName("Открыть боковое меню");
  const toggleBox = await toggle.boundingBox();
  await toggle.click();
  await expect(page.locator(".side-menu")).toHaveAttribute("aria-hidden", "false");
  await expect(page.getByRole("button", { name: "Закрыть боковое меню", exact: true })).toHaveCount(1);
  await expect(page.locator(".side-menu button")).toHaveCount(0);
  return { toggle, toggleBox };
};

const closeMenu = async (page) => {
  await page.locator(".menu-toggle").click();
  await expect(page.locator(".side-menu")).toHaveAttribute("aria-hidden", "true");
};

const expectBackgroundAvailable = async (page) => {
  await expect(page.locator(".site-header")).not.toHaveAttribute("inert", "");
  await expect
    .poll(() =>
      page
        .locator(".site-header a, .site-header button")
        .evaluateAll((elements) => elements.every((element) => !element.hasAttribute("inert")))
    )
    .toBe(true);
  await expect(page.locator("main")).not.toHaveAttribute("inert", "");
  await expect(page.locator(".site-footer")).not.toHaveAttribute("inert", "");
  const backToTop = page.locator(".back-to-top");
  if (await backToTop.count()) {
    await expect(backToTop).not.toHaveAttribute("inert", "");
  }
};

test("drawer keeps one stationary toggle and traps focus across the menu on every page", async ({ page }) => {
  const pages = [
    { path: "/index.html", link: '#team', url: /index\.html#team$/ },
    { path: "/news.html", link: "index.html#team", url: /index\.html#team$/ },
    { path: "/developments.html", link: "index.html#team", url: /index\.html#team$/ },
    { path: "/disclaimer.html", link: "index.html#team", url: /index\.html#team$/ },
  ];

  for (const currentPage of pages) {
    await page.goto(currentPage.path, { waitUntil: "load" });
    const { toggle, toggleBox: initialToggleBox } = await openMenu(page);
    const drawer = page.locator(".side-menu");
    const close = page.locator(".menu-toggle");
    const focusableElements = drawer.locator(
      "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
    );

    await expect(close).toBeFocused();
    expect(await toggle.boundingBox()).toEqual(initialToggleBox);
    await expect(page.locator(".site-header")).not.toHaveAttribute("inert", "");
    await expect
      .poll(() =>
        page
          .locator(".site-header a, .theme-toggle")
          .evaluateAll((elements) => elements.every((element) => element.hasAttribute("inert")))
      )
      .toBe(true);
    await expect(page.locator("main")).toHaveAttribute("inert", "");
    await expect(page.locator(".site-footer")).toHaveAttribute("inert", "");
    const backToTop = page.locator(".back-to-top");
    if (await backToTop.count()) {
      await expect(backToTop).toHaveAttribute("inert", "");
    }
    await expect(drawer).not.toHaveAttribute("inert", "");

    await focusableElements.last().focus();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(focusableElements.last()).toBeFocused();

    const axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations).toEqual([]);

    await close.focus();
    await page.keyboard.press("Escape");
    await expect(toggle).toBeFocused();
    await expectBackgroundAvailable(page);

    await openMenu(page);
    await closeMenu(page);
    await expect(toggle).toBeFocused();
    await expectBackgroundAvailable(page);

    await openMenu(page);
    await page.locator("[data-menu-overlay]").click({ position: { x: 12, y: 12 } });
    await expect(toggle).toBeFocused();
    await expectBackgroundAvailable(page);

    await openMenu(page);
    await drawer.locator(`.side-menu__link[href="${currentPage.link}"]`).click();
    await expect(page).toHaveURL(currentPage.url);
    await expect(drawer).toHaveAttribute("inert", "");
  }
});

test("drawer locks background scroll only while open and restores its position", async ({ page }) => {
  await page.goto("/index.html", { waitUntil: "load" });
  await page.evaluate(() => window.scrollTo(0, 900));
  const beforeOpen = await page.evaluate(() => window.scrollY);

  await openMenu(page);
  await page.mouse.wheel(0, 640);
  expect(await page.evaluate(() => window.scrollY)).toBe(beforeOpen);

  await closeMenu(page);
  expect(await page.evaluate(() => window.scrollY)).toBe(beforeOpen);
  await page.mouse.wheel(0, 640);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(beforeOpen);
});
