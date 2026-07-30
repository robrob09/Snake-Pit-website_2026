const { expect, test } = require("@playwright/test");

const collectPageErrors = (page) => {
  const errors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`);
  });

  page.on("response", (response) => {
    if (response.url().startsWith("http://127.0.0.1") && response.status() >= 400) {
      errors.push(`http ${response.status()}: ${response.url()}`);
    }
  });

  return errors;
};

const installPerformanceObservers = async (page) => {
  await page.addInitScript(() => {
    window.__snakePerformance = {
      longTasks: [],
      layoutShifts: [],
    };

    try {
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          window.__snakePerformance.longTasks.push({
            duration: entry.duration,
            startTime: entry.startTime,
          });
        });
      }).observe({ type: "longtask", buffered: true });
    } catch {
      // Older browsers may not expose Long Tasks.
    }

    try {
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (!entry.hadRecentInput) {
            window.__snakePerformance.layoutShifts.push({
              value: entry.value,
              startTime: entry.startTime,
            });
          }
        });
      }).observe({ type: "layout-shift", buffered: true });
    } catch {
      // Older browsers may not expose Layout Instability.
    }
  });
};

const enableThrottling = async (page) => {
  const session = await page.context().newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (750 * 1024) / 8,
    uploadThroughput: (330 * 1024) / 8,
    connectionType: "cellular3g",
  });
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  return session;
};

const touchSwipeUp = async (session) => {
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 195, y: 690 }],
  });

  for (let y = 640; y >= 190; y -= 50) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 195, y }],
    });
  }

  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
};

const clickMenuToggle = async (page) => {
  const toggle = page.locator(".menu-toggle");
  await expect(toggle).toBeVisible();
  const box = await toggle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

const closeMenu = async (page) => {
  await clickMenuToggle(page);
};

test("manual scrolling wins over slow-load hash positioning", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.route("**/@vite/client", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "",
    })
  );
  await installPerformanceObservers(page);
  const session = await enableThrottling(page);

  await page.goto("/index.html#rules", { waitUntil: "domcontentloaded" });
  await page.mouse.wheel(0, 620);
  await page.waitForTimeout(60);
  const manualScrollY = await page.evaluate(() => window.scrollY);

  await page.waitForLoadState("load");
  await page.waitForTimeout(350);
  const settledScrollY = await page.evaluate(() => window.scrollY);

  expect(manualScrollY).toBeGreaterThan(0);
  expect(Math.abs(settledScrollY - manualScrollY)).toBeLessThan(3);

  const scrollStart = await page.evaluate(() => performance.now());
  for (let index = 0; index < 8; index += 1) {
    await page.mouse.wheel(0, 440);
  }
  const afterRapidScroll = await page.evaluate(() => window.scrollY);
  expect(afterRapidScroll).toBeGreaterThan(settledScrollY);

  const scrollLongTasks = await page.evaluate(
    (startTime) =>
      window.__snakePerformance.longTasks.filter((entry) => entry.startTime >= startTime),
    scrollStart
  );
  expect(scrollLongTasks).toEqual([]);
  expect(errors).toEqual([]);

  await session.detach();
});

test("touch scroll, menu locking, theme, and back-to-top preserve position", async ({ page }) => {
  const errors = collectPageErrors(page);
  const session = await page.context().newCDPSession(page);
  await page.goto("/index.html", { waitUntil: "load" });

  await clickMenuToggle(page);
  await closeMenu(page);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await touchSwipeUp(session);
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await page.reload({ waitUntil: "load" });
  await page.evaluate(() => window.scrollTo(0, 1900));
  const beforeMenuY = await page.evaluate(() => window.scrollY);
  await clickMenuToggle(page);
  const lockedMenuY = await page.evaluate(() => window.scrollY);
  expect(lockedMenuY).toBe(beforeMenuY);
  await page.mouse.wheel(0, 600);
  expect(await page.evaluate(() => window.scrollY)).toBe(lockedMenuY);
  await closeMenu(page);
  expect(await page.evaluate(() => window.scrollY)).toBe(lockedMenuY);

  await clickMenuToggle(page);
  const lockedEscapeY = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => window.scrollY)).toBe(lockedEscapeY);

  const themeBefore = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    y: window.scrollY,
  }));
  await page.locator("[data-theme-toggle]").click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
    .not.toBe(themeBefore.theme);
  const themeAfter = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    y: window.scrollY,
  }));
  expect(themeAfter.y).toBe(themeBefore.y);

  const awayPage = await page.context().newPage();
  await awayPage.goto("about:blank");
  await awayPage.bringToFront();
  await page.bringToFront();
  await awayPage.close();
  expect(await page.evaluate(() => window.scrollY)).toBe(themeAfter.y);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.getByRole("button", { name: "Вернуться наверх", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  expect(errors).toEqual([]);

  await session.detach();
});

test("news scrolling and expansion remain responsive", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto("/news.html", { waitUntil: "load" });

  await page.mouse.wheel(0, 640);
  await page.waitForTimeout(60);
  const firstScrollY = await page.evaluate(() => window.scrollY);
  expect(firstScrollY).toBeGreaterThan(0);

  for (let index = 0; index < 6; index += 1) {
    await page.mouse.wheel(0, 360);
  }
  await page.waitForTimeout(60);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(firstScrollY);

  await page.evaluate(() => window.scrollTo(0, 0));
  const firstCard = page
    .locator("[data-news-card]")
    .filter({ hasText: "Сумерки. Сага: Рассвет" });
  const toggle = firstCard.locator(".news-card__toggle");
  await firstCard.locator(".news-card__title").click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const expandedBorders = await firstCard.evaluate((card) => {
    const meta = getComputedStyle(card.querySelector(".news-card__meta"));
    const body = getComputedStyle(card.querySelector(".news-card__body"));

    return {
      metaBottom: Number.parseFloat(meta.borderBottomWidth),
      bodyTop: Number.parseFloat(body.borderTopWidth),
    };
  });
  expect(expandedBorders.metaBottom).toBeGreaterThan(0);
  expect(expandedBorders.bodyTop).toBe(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(errors).toEqual([]);
});

test("same-page anchors, Back/Forward, and cross-page navigation stay predictable", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  await page.goto("/index.html#top", { waitUntil: "load" });

  await page.locator('.site-header a[href="#rules"]').click();
  await expect(page).toHaveURL(/#rules$/);
  await expect.poll(async () => {
    const ruleOffset = await page.locator("#rules").evaluate((element) => {
      const header = document.querySelector(".site-header");
      return {
        headerHeight: header.getBoundingClientRect().height,
        targetTop: element.getBoundingClientRect().top,
      };
    });
    return Math.abs(ruleOffset.targetTop - ruleOffset.headerHeight);
  }).toBeLessThan(2);

  await page.goBack();
  await expect(page).toHaveURL(/#top$/);
  await page.goForward();
  await expect(page).toHaveURL(/#rules$/);

  await clickMenuToggle(page);
  await page.locator('.side-menu a[href="news.html"]').click();
  await expect(page).toHaveURL(/news\.html$/);
  await page.goBack();
  await expect(page).toHaveURL(/index\.html#rules$/);
  expect(errors).toEqual([]);
});

test("reduced motion disables expensive movement", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/index.html", { waitUntil: "load" });

  const styles = await page.evaluate(() => {
    const hero = getComputedStyle(document.querySelector(".hero-symbol img"));
    const header = getComputedStyle(document.querySelector(".site-header"));
    return {
      animationDuration: hero.animationDuration,
      backdropFilter: header.backdropFilter,
      webkitBackdropFilter: header.webkitBackdropFilter,
    };
  });

  expect(Number.parseFloat(styles.animationDuration)).toBeLessThan(0.001);
  expect([styles.backdropFilter, styles.webkitBackdropFilter]).not.toContain("blur(18px)");
  expect(errors).toEqual([]);
});

test("images keep their proportions across every page and breakpoint", async ({ page }) => {
  const errors = collectPageErrors(page);
  const pagePaths = ["/index.html", "/news.html", "/developments.html", "/disclaimer.html"];

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);

    for (const pagePath of pagePaths) {
      await page.goto(pagePath, { waitUntil: "load" });
      await page.evaluate(() => {
        document.querySelectorAll('img[loading="lazy"]').forEach((image) => {
          image.loading = "eager";
        });
        window.scrollTo(0, document.documentElement.scrollHeight);
      });
      await expect
        .poll(() =>
          page.evaluate(() =>
            Array.from(document.images).every((image) => {
              const styles = getComputedStyle(image);
              const rect = image.getBoundingClientRect();
              const visible =
                styles.display !== "none" &&
                styles.visibility !== "hidden" &&
                rect.width > 0 &&
                rect.height > 0;
              return !visible || (image.complete && image.naturalWidth > 0);
            })
          )
        )
        .toBe(true);

      const audit = await page.evaluate(() => ({
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        images: Array.from(document.images).map((image) => {
          const styles = getComputedStyle(image);
          const rect = image.getBoundingClientRect();
          const visible =
            styles.display !== "none" &&
            styles.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0;

          return {
            loaded: !visible || (image.complete && image.naturalWidth > 0),
            ratioDelta:
              visible && image.naturalHeight > 0
                ? Math.abs(rect.width / rect.height - image.naturalWidth / image.naturalHeight)
                : 0,
          };
        }),
      }));

      expect(audit.overflowX).toBeLessThanOrEqual(0);
      expect(audit.images.every((image) => image.loaded)).toBe(true);
      expect(audit.images.every((image) => image.ratioDelta < 0.02)).toBe(true);
    }
  }

  expect(errors).toEqual([]);
});

test("mobile navigation is opaque and the hero symbol uses the available space", async ({
  page,
}) => {
  const errors = collectPageErrors(page);

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/index.html", { waitUntil: "load" });

  const tabletHero = await page.evaluate(() => {
    const image = document.querySelector(".hero-symbol img");
    image.style.animation = "none";

    const area = document.querySelector(".hero-symbol").getBoundingClientRect();
    const symbol = image.getBoundingClientRect();
    const actions = document.querySelector(".hero-actions").getBoundingClientRect();

    return {
      areaBottomDelta: Math.abs(area.bottom - actions.bottom),
      centerDelta: Math.abs(
        (symbol.top + symbol.bottom) / 2 - (area.top + area.bottom) / 2
      ),
      symbolRatio: symbol.width / symbol.height,
      symbolWidth: symbol.width,
    };
  });

  expect(tabletHero.areaBottomDelta).toBeLessThan(1);
  expect(tabletHero.centerDelta).toBeLessThan(1);
  expect(Math.abs(tabletHero.symbolRatio - 1)).toBeLessThan(0.01);
  expect(tabletHero.symbolWidth).toBeGreaterThan(280);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.reload({ waitUntil: "load" });

  const desktopHero = await page.evaluate(() => {
    const image = document.querySelector(".hero-symbol img");
    image.style.animation = "none";

    const area = document.querySelector(".hero-symbol").getBoundingClientRect();
    const symbol = image.getBoundingClientRect();
    const actions = document.querySelector(".hero-actions").getBoundingClientRect();

    return {
      areaBottomDelta: Math.abs(area.bottom - actions.bottom),
      symbolRatio: symbol.width / symbol.height,
      symbolWidth: symbol.width,
    };
  });

  expect(desktopHero.areaBottomDelta).toBeLessThan(1);
  expect(Math.abs(desktopHero.symbolRatio - 1)).toBeLessThan(0.01);
  expect(desktopHero.symbolWidth).toBeGreaterThan(300);

  await page.setViewportSize({ width: 390, height: 844 });

  for (const theme of ["dark", "light"]) {
    await page.goto("/index.html", { waitUntil: "load" });
    await page.evaluate((nextTheme) => localStorage.setItem("theme", nextTheme), theme);
    await page.reload({ waitUntil: "load" });

    const phoneHero = await page.evaluate(() => {
      const headerStyle = getComputedStyle(document.querySelector(".site-header"));
      const logo = document.querySelector(".hero-logo").getBoundingClientRect();
      const kicker = document.querySelector(".hero-kicker").getBoundingClientRect();
      const symbolStyle = getComputedStyle(document.querySelector(".hero-symbol"));

      return {
        headerBackground: headerStyle.backgroundColor,
        headerBackdrop: headerStyle.backdropFilter || headerStyle.webkitBackdropFilter,
        logoAboveKicker: logo.bottom <= kicker.top,
        symbolDisplay: symbolStyle.display,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    expect(phoneHero.headerBackground).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    expect(phoneHero.headerBackdrop).toBe("none");
    expect(phoneHero.logoAboveKicker).toBe(true);
    expect(phoneHero.symbolDisplay).toBe("none");
    expect(phoneHero.overflowX).toBeLessThanOrEqual(0);
  }

  expect(errors).toEqual([]);
});

test("menu state and navigation timing match the visible section", async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/index.html", { waitUntil: "load" });

  const initialVisuals = await page.evaluate(() => {
    const symbol = document.querySelector(".hero-symbol img").getBoundingClientRect();
    const logo = document.querySelector(".hero-logo").getBoundingClientRect();
    const kicker = document.querySelector(".hero-kicker").getBoundingClientRect();
    const sideMenu = getComputedStyle(document.querySelector(".side-menu"));

    return {
      grid: getComputedStyle(document.body, "::before").backgroundImage,
      heroTopDifference: Math.abs(logo.top - kicker.top),
      symbolRatio: symbol.width / symbol.height,
      symbolWidth: symbol.width,
      menuDuration: Number.parseFloat(sideMenu.transitionDuration),
    };
  });

  expect(initialVisuals.grid).toBe("none");
  expect(initialVisuals.heroTopDifference).toBeLessThan(1);
  expect(Math.abs(initialVisuals.symbolRatio - 1)).toBeLessThan(0.01);
  expect(initialVisuals.symbolWidth).toBeGreaterThan(240);
  expect(initialVisuals.menuDuration).toBeGreaterThanOrEqual(0.45);

  await page.evaluate(() => {
    window.__snakeScrollMeasurement = { start: null, last: null };
    document.addEventListener(
      "click",
      (event) => {
        if (event.target.closest('.site-header a[href="#team"]')) {
          window.__snakeScrollMeasurement.start = performance.now();
        }
      },
      { capture: true }
    );
    window.addEventListener(
      "scroll",
      () => {
        window.__snakeScrollMeasurement.last = performance.now();
      },
      { passive: true }
    );
  });

  await page.locator('.site-header a[href="#team"]').click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const target = document.querySelector("#team");
        const header = document.querySelector(".site-header");
        return Math.abs(target.getBoundingClientRect().top - header.getBoundingClientRect().height);
      })
    )
    .toBeLessThan(2);

  const scrollDuration = await page.evaluate(() => {
    const measurement = window.__snakeScrollMeasurement;
    return measurement.last - measurement.start;
  });
  expect(scrollDuration).toBeGreaterThanOrEqual(450);
  expect(scrollDuration).toBeLessThanOrEqual(510);

  await expect(page.locator('.side-menu__link[href="#team"]')).toHaveClass(/is-active/);
  const headerWidthBefore = await page.locator(".site-header").evaluate((header) => {
    return header.getBoundingClientRect().width;
  });

  await clickMenuToggle(page);
  await page.waitForTimeout(500);

  const menuState = await page.evaluate(() => ({
    active: Array.from(document.querySelectorAll(".side-menu__link.is-active")).map((link) =>
      link.textContent.trim()
    ),
    headerWidth: document.querySelector(".site-header").getBoundingClientRect().width,
  }));

  expect(menuState.active).toEqual(["О нас"]);
  expect(Math.abs(menuState.headerWidth - headerWidthBefore)).toBeLessThan(1);
  expect(errors).toEqual([]);
});

test("inner pages expose their current menu item and transitions stay smooth", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  const currentItems = [
    ["/news.html", "Новости"],
    ["/developments.html", "Наши разработки"],
    ["/disclaimer.html", "Отказ от ответственности"],
  ];

  for (const [pagePath, itemText] of currentItems) {
    await page.goto(pagePath, { waitUntil: "load" });
    const activeLinks = page.locator(".side-menu__link.is-active");
    await expect(activeLinks).toHaveCount(1);
    await expect(activeLinks).toHaveText(itemText);
    await expect(activeLinks).toHaveAttribute("aria-current", "page");
  }

  await page.goto("/news.html", { waitUntil: "load" });
  await page.evaluate(() => {
    sessionStorage.removeItem("snake-page-transition-seen");
    const observer = new MutationObserver(() => {
      if (document.body.classList.contains("page-is-leaving")) {
        sessionStorage.setItem("snake-page-transition-seen", "true");
        observer.disconnect();
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  });
  await page.locator('.site-header .nav-link[href="index.html#top"]').click();
  await expect(page).toHaveURL(/index\.html#top$/);
  expect(await page.evaluate(() => sessionStorage.getItem("snake-page-transition-seen"))).toBe(
    "true"
  );

  const themeBefore = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.locator("[data-theme-toggle]").click();
  await expect(page.locator("html")).toHaveClass(/theme-transition|theme-transition-fallback/);
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.classList.contains("theme-transition") ||
        document.documentElement.classList.contains("theme-transition-fallback")
      )
    )
    .toBe(false);
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).not.toBe(themeBefore);
  expect(errors).toEqual([]);
});

test("opening and closing the menu preserves scroll on every page", async ({ page }) => {
  const errors = collectPageErrors(page);
  const pagePaths = ["/index.html", "/news.html", "/developments.html", "/disclaimer.html"];

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);

    for (const pagePath of pagePaths) {
      await page.goto(pagePath, { waitUntil: "load" });
      const positionBefore = await page.evaluate(() => {
        const maxScroll = Math.max(
          0,
          document.documentElement.scrollHeight - document.documentElement.clientHeight
        );
        window.scrollTo(0, Math.min(700, maxScroll));
        return window.scrollY;
      });

      await clickMenuToggle(page);
      const positionWhileOpen = await page.evaluate(() => window.scrollY);
      expect(Math.abs(positionWhileOpen - positionBefore)).toBeLessThan(1);

      await closeMenu(page);
      const positionAfter = await page.evaluate(() => window.scrollY);
      expect(Math.abs(positionAfter - positionBefore)).toBeLessThan(1);
    }
  }

  expect(errors).toEqual([]);
});
