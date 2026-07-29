import { resolveThemeAsset } from "./theme-assets.js";

(function () {
  const root = document.documentElement;
  const body = document.body;
  const themeToggle = document.querySelector("[data-theme-toggle]");
  const lightThemeIcon = themeToggle?.querySelector(".theme-toggle__icon--light");
  const darkThemeIcon = themeToggle?.querySelector(".theme-toggle__icon--dark");
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const menuToggle = document.querySelector(".menu-toggle");
  const menuToggleIcon = menuToggle?.querySelector(".menu-toggle__icon");
  const heroSymbol = document.querySelector(".hero-symbol");
  const sideMenu = document.querySelector(".side-menu");
  const overlay = document.querySelector("[data-menu-overlay]");
  const backToTop = document.querySelector(".back-to-top");
  const newsCards = Array.from(document.querySelectorAll("[data-news-card]"));
  const themeAwareSources = Array.from(
    document.querySelectorAll("[data-theme-src-light][data-theme-src-dark]")
  );
  const siteHeader = document.querySelector(".site-header");
  const navSectionLinks = Array.from(document.querySelectorAll("[data-section-link]"));
  const HOME_SECTION_IDS = ["top", "team", "rules", "contacts"];
  const homeSectionTargets = HOME_SECTION_IDS.map((sectionId) =>
    document.getElementById(sectionId)
  ).filter(Boolean);
  const isHomePage = Boolean(document.querySelector(".hero#top"));
  const THEME_KEY = "theme";
  const HASH_SCROLL_GAP = 0;
  const NAVIGATION_SCROLL_DURATION = 480;
  const PAGE_EXIT_DURATION = 180;
  const THEME_TRANSITION_DURATION = 320;
  const THEME_COLORS = {
    dark: "#08131f",
    light: "#f6f8f3",
  };

  let savedScrollY = 0;
  let menuIsOpen = false;
  let menuOpener = null;
  let headerSyncFrame = 0;
  let activeNavFrame = 0;
  let cachedHeaderHeight = 0;
  let cachedDocumentHeight = 0;
  let cachedSectionMetrics = [];
  let currentActiveSectionId = "";
  let heroSymbolIsInView = false;
  let heroSymbolFallbackFrame = 0;
  let pendingNavigationFrame = 0;
  let navigationScrollFrame = 0;
  let pageNavigationTimer = 0;
  let themeTransitionTimer = 0;

  const storage = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        return null;
      }
      return value;
    },
  };

  const getSystemTheme = () => {
    if (window.matchMedia?.("(prefers-color-scheme: light)").matches) {
      return "light";
    }

    return "dark";
  };

  const getSavedTheme = () => {
    const saved = storage.get(THEME_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  };

  const getScrollY = () => {
    const scrollingRoot = document.scrollingElement || document.documentElement;
    return Math.max(0, Math.round(window.scrollY || scrollingRoot.scrollTop || 0));
  };

  const shouldReduceMotion = () =>
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  const getHeaderHeight = () => {
    if (!siteHeader) {
      return 0;
    }

    return Math.round(siteHeader.getBoundingClientRect().height);
  };

  const syncHeaderHeight = () => {
    if (!siteHeader) {
      cachedHeaderHeight = 0;
      return 0;
    }

    const nextHeight = getHeaderHeight();

    if (nextHeight > 0 && nextHeight !== cachedHeaderHeight) {
      root.style.setProperty("--nav-height", `${nextHeight}px`);
    }

    cachedHeaderHeight = nextHeight;
    return nextHeight;
  };

  const getDocumentHeight = () =>
    Math.max(
      body.scrollHeight,
      document.documentElement.scrollHeight,
      body.offsetHeight,
      document.documentElement.offsetHeight
    );

  const refreshActiveNavMetrics = () => {
    cachedDocumentHeight = getDocumentHeight();

    if (!isHomePage || homeSectionTargets.length === 0) {
      cachedSectionMetrics = [];
      return;
    }

    const scrollY = getScrollY();
    cachedSectionMetrics = homeSectionTargets.map((section) => ({
      id: section.id,
      top: Math.round(section.getBoundingClientRect().top + scrollY),
    }));
  };

  const syncScrollMetrics = () => {
    const nextHeaderHeight = syncHeaderHeight();
    refreshActiveNavMetrics();
    return nextHeaderHeight;
  };

  const scheduleHeaderSync = () => {
    if (headerSyncFrame) {
      return;
    }

    headerSyncFrame = window.requestAnimationFrame(() => {
      headerSyncFrame = 0;
      syncScrollMetrics();
      scheduleActiveNavUpdate();
    });
  };

  const withInstantScroll = (callback) => {
    const previousScrollBehavior = root.style.scrollBehavior;
    root.classList.add("is-restoring-scroll");
    root.style.scrollBehavior = "auto";
    callback();

    window.requestAnimationFrame(() => {
      root.style.scrollBehavior = previousScrollBehavior;
      root.classList.remove("is-restoring-scroll");
    });
  };

  const getTargetFromHash = (hash) => {
    if (!hash || hash === "#") {
      return null;
    }

    if (hash === "#top") {
      return document.getElementById("top") || document.body;
    }

    try {
      return document.querySelector(hash);
    } catch (error) {
      return null;
    }
  };

  const updateHistoryHash = (hash, mode) => {
    if (mode === "none") {
      return;
    }

    const nextHash = hash || "#top";

    if (mode === "push") {
      if (window.location.hash === nextHash) {
        history.replaceState(null, "", nextHash);
      } else {
        history.pushState(null, "", nextHash);
      }
      return;
    }

    history.replaceState(null, "", nextHash);
  };

  const cancelNavigationScrollAnimation = () => {
    if (!navigationScrollFrame) {
      return;
    }

    window.cancelAnimationFrame(navigationScrollFrame);
    navigationScrollFrame = 0;
  };

  const animateNavigationScroll = (targetTop) => {
    cancelNavigationScrollAnimation();

    const startTop = getScrollY();
    const distance = targetTop - startTop;

    if (shouldReduceMotion() || Math.abs(distance) < 1) {
      window.scrollTo({ top: targetTop, left: 0, behavior: "auto" });
      return;
    }

    const startTime = performance.now();
    const easeInOutCubic = (progress) =>
      progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    const step = (timestamp) => {
      const progress = Math.min(1, (timestamp - startTime) / NAVIGATION_SCROLL_DURATION);
      const nextTop = startTop + distance * easeInOutCubic(progress);
      window.scrollTo({ top: nextTop, left: 0, behavior: "auto" });

      if (progress < 1) {
        navigationScrollFrame = window.requestAnimationFrame(step);
        return;
      }

      navigationScrollFrame = 0;
      window.scrollTo({ top: targetTop, left: 0, behavior: "auto" });
    };

    navigationScrollFrame = window.requestAnimationFrame(step);
  };

  const scrollToHash = (hash, options = {}) => {
    const { behavior = "auto", historyMode = "none" } = options;

    if (!hash) {
      return false;
    }

    const headerHeight = syncScrollMetrics();
    let nextTop = 0;

    if (hash !== "#top") {
      const target = getTargetFromHash(hash);
      if (!target) {
        return false;
      }

      const targetTop = target.getBoundingClientRect().top + getScrollY();
      nextTop = Math.max(0, Math.round(targetTop - headerHeight - HASH_SCROLL_GAP));
    }

    if (behavior === "smooth" && !shouldReduceMotion()) {
      animateNavigationScroll(nextTop);
    } else {
      cancelNavigationScrollAnimation();
      window.scrollTo({ top: nextTop, left: 0, behavior: "auto" });
    }

    updateHistoryHash(hash, historyMode);
    return true;
  };

  const setActiveSection = (sectionId) => {
    if (!isHomePage || !sectionId) {
      return;
    }

    if (currentActiveSectionId === sectionId) {
      return;
    }

    currentActiveSectionId = sectionId;

    navSectionLinks.forEach((link) => {
      const isActive = link.dataset.sectionLink === sectionId;
      link.classList.toggle("is-active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const updateActiveNav = () => {
    if (!isHomePage || navSectionLinks.length === 0 || homeSectionTargets.length === 0) {
      return;
    }

    if (cachedSectionMetrics.length === 0) {
      syncScrollMetrics();
    }

    const scrollY = menuIsOpen ? savedScrollY : getScrollY();
    const contentViewportHeight = Math.max(0, window.innerHeight - cachedHeaderHeight);
    const activationLine =
      scrollY + cachedHeaderHeight + contentViewportHeight / 2 + HASH_SCROLL_GAP + 1;
    let activeSectionId = cachedSectionMetrics[0]?.id || homeSectionTargets[0].id;

    cachedSectionMetrics.forEach((section) => {
      if (activationLine >= section.top) {
        activeSectionId = section.id;
      }
    });

    const pageBottom = Math.ceil(scrollY + window.innerHeight);

    if (pageBottom >= cachedDocumentHeight - 2) {
      activeSectionId = homeSectionTargets[homeSectionTargets.length - 1].id;
    }

    setActiveSection(activeSectionId);
  };

  function scheduleActiveNavUpdate() {
    if (!isHomePage || activeNavFrame) {
      return;
    }

    activeNavFrame = window.requestAnimationFrame(() => {
      activeNavFrame = 0;
      updateActiveNav();
    });
  }

  const syncHeroSymbolAnimation = () => {
    if (!heroSymbol) {
      return;
    }

    const documentIsVisible = document.visibilityState !== "hidden";
    heroSymbol.classList.toggle(
      "is-visible",
      heroSymbolIsInView && documentIsVisible && !menuIsOpen
    );
  };

  const measureHeroSymbolVisibility = () => {
    if (!heroSymbol) {
      return false;
    }

    const rect = heroSymbol.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    return (
      rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth
    );
  };

  const updateHeroSymbolFallbackVisibility = () => {
    heroSymbolFallbackFrame = 0;
    heroSymbolIsInView = measureHeroSymbolVisibility();
    syncHeroSymbolAnimation();
  };

  const scheduleHeroSymbolFallbackVisibility = () => {
    if (!heroSymbol || heroSymbolFallbackFrame) {
      return;
    }

    heroSymbolFallbackFrame = window.requestAnimationFrame(updateHeroSymbolFallbackVisibility);
  };

  const initHeroSymbolAnimation = () => {
    if (!heroSymbol) {
      return;
    }

    document.addEventListener("visibilitychange", syncHeroSymbolAnimation);
    window.addEventListener("pageshow", syncHeroSymbolAnimation);
    window.addEventListener("pagehide", () => {
      heroSymbol.classList.remove("is-visible");
    });

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          heroSymbolIsInView = Boolean(entry?.isIntersecting && entry.intersectionRatio > 0);
          syncHeroSymbolAnimation();
        },
        { threshold: 0 }
      );

      observer.observe(heroSymbol);
      return;
    }

    updateHeroSymbolFallbackVisibility();
    window.addEventListener("scroll", scheduleHeroSymbolFallbackVisibility, { passive: true });
    window.addEventListener("resize", scheduleHeroSymbolFallbackVisibility);
    window.addEventListener("orientationchange", scheduleHeroSymbolFallbackVisibility);
    window.addEventListener("load", scheduleHeroSymbolFallbackVisibility, { once: true });
  };

  const syncThemeToggleIcons = () => {
    if (lightThemeIcon) {
      const lightThemeIconSource = resolveThemeAsset("light-mode");

      if (lightThemeIconSource) {
        lightThemeIcon.src = lightThemeIconSource;
      }
    }

    if (darkThemeIcon) {
      const darkThemeIconSource = resolveThemeAsset("dark-mode");

      if (darkThemeIconSource) {
        darkThemeIcon.src = darkThemeIconSource;
      }
    }
  };

  const cancelPendingNavigationScroll = () => {
    if (!pendingNavigationFrame) {
      return;
    }

    window.cancelAnimationFrame(pendingNavigationFrame);
    pendingNavigationFrame = 0;
  };

  const cancelProgrammaticNavigation = () => {
    cancelPendingNavigationScroll();
    cancelNavigationScrollAnimation();
  };

  const scheduleNavigationScroll = (callback) => {
    cancelProgrammaticNavigation();
    pendingNavigationFrame = window.requestAnimationFrame(() => {
      pendingNavigationFrame = 0;
      callback();
    });
  };

  const getThemeSourceKey = (theme) => (theme === "light" ? "themeSrcLight" : "themeSrcDark");

  const syncThemeAwareSources = (theme) => {
    if (themeAwareSources.length === 0) {
      return;
    }

    const nextTheme = theme === "light" ? "light" : "dark";
    const sourceKey = getThemeSourceKey(nextTheme);

    themeAwareSources.forEach((element) => {
      const nextSource = resolveThemeAsset(element.dataset[sourceKey]);
      const sourceAttribute = element.tagName === "LINK" ? "href" : "src";
      const srcsetKey = nextTheme === "light" ? "themeSrcsetLight" : "themeSrcsetDark";
      const nextSrcset = element.dataset[srcsetKey]
        ? resolveThemeAsset(element.dataset[srcsetKey])
        : null;

      if (nextSrcset && element.getAttribute("srcset") !== nextSrcset) {
        element.setAttribute("srcset", nextSrcset);
      }

      if (!nextSource || element.getAttribute(sourceAttribute) === nextSource) {
        return;
      }

      element.setAttribute(sourceAttribute, nextSource);
    });
  };

  const syncMenuToggle = () => {
    if (!menuToggle) {
      return;
    }

    const theme = root.dataset.theme === "light" ? "light" : "dark";
    const iconName = menuIsOpen ? "close" : "hamburger";
    const label = menuIsOpen
      ? "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u0431\u043E\u043A\u043E\u0432\u043E\u0435 \u043C\u0435\u043D\u044E"
      : "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0431\u043E\u043A\u043E\u0432\u043E\u0435 \u043C\u0435\u043D\u044E";

    if (menuToggleIcon) {
      const stateName = menuIsOpen ? "Close" : "Hamburger";
      const themeName = theme === "light" ? "Light" : "Dark";
      const sourceKey = `menuIcon${stateName}${themeName}`;
      const fallbackAssetKey = `${iconName}-${theme}`;
      const nextSource = resolveThemeAsset(
        menuToggleIcon.dataset[sourceKey] || fallbackAssetKey
      );

      if (nextSource && menuToggleIcon.getAttribute("src") !== nextSource) {
        menuToggleIcon.setAttribute("src", nextSource);
      }
    }

    menuToggle.setAttribute("aria-expanded", String(menuIsOpen));
    menuToggle.setAttribute("aria-label", label);
    menuToggle.title = label;

    if (sideMenu) {
      sideMenu.setAttribute("aria-hidden", String(!menuIsOpen));

      if (menuIsOpen) {
        sideMenu.removeAttribute("inert");
      } else {
        sideMenu.setAttribute("inert", "");
      }
    }
  };

  const setTheme = (theme, shouldPersist) => {
    const nextTheme = theme === "light" ? "light" : "dark";
    root.dataset.theme = nextTheme;

    if (themeMeta) {
      themeMeta.setAttribute("content", THEME_COLORS[nextTheme]);
    }

    if (themeToggle) {
      const isLight = nextTheme === "light";
      const label = isLight
        ? "\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0442\u0435\u043C\u043D\u0443\u044E \u0442\u0435\u043C\u0443"
        : "\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0441\u0432\u0435\u0442\u043B\u0443\u044E \u0442\u0435\u043C\u0443";
      themeToggle.setAttribute("aria-pressed", String(isLight));
      themeToggle.setAttribute("aria-label", label);
      themeToggle.title = label;
    }

    syncThemeToggleIcons();
    syncThemeAwareSources(nextTheme);
    syncMenuToggle();

    if (shouldPersist) {
      storage.set(THEME_KEY, nextTheme);
    }
  };

  const setThemeWithTransition = (theme, shouldPersist) => {
    if (shouldReduceMotion()) {
      setTheme(theme, shouldPersist);
      return;
    }

    window.clearTimeout(themeTransitionTimer);
    root.classList.remove("theme-transition", "theme-transition-fallback");

    if (typeof document.startViewTransition === "function") {
      root.classList.add("theme-transition");
      const transition = document.startViewTransition(() => {
        setTheme(theme, shouldPersist);
      });

      transition.finished
        .then(() => {
          root.classList.remove("theme-transition");
        })
        .catch(() => {
          root.classList.remove("theme-transition");
        });
      return;
    }

    root.classList.add("theme-transition-fallback");
    setTheme(theme, shouldPersist);
    themeTransitionTimer = window.setTimeout(() => {
      root.classList.remove("theme-transition-fallback");
      themeTransitionTimer = 0;
    }, THEME_TRANSITION_DURATION);
  };

  const lockBodyScroll = () => {
    savedScrollY = getScrollY();
  };

  const unlockBodyScroll = () => {
    const restoreY = savedScrollY;

    withInstantScroll(() => {
      window.scrollTo({ top: restoreY, left: 0, behavior: "auto" });
    });

    savedScrollY = 0;
  };

  const getMenuFocusableElements = () => {
    if (!sideMenu) {
      return [];
    }

    const drawerElements = Array.from(
      sideMenu.querySelectorAll(
        "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
      )
    ).filter(
      (element) =>
        element &&
        !element.hasAttribute("inert") &&
        element.getClientRects().length > 0
    );

    const headerElements = [themeToggle, menuToggle].filter(
      (element) =>
        element &&
        !element.hasAttribute("inert") &&
        element.getClientRects().length > 0
    );

    return [...headerElements, ...drawerElements];
  };

  const setBackgroundInert = (isInert) => {
    Array.from(body.children).forEach((element) => {
      if (element === sideMenu || element === overlay || element.tagName === "SCRIPT") {
        return;
      }

      if (element === siteHeader && menuToggle) {
        element
          .querySelectorAll(
            "a[href], button, input, select, textarea, [tabindex]"
          )
          .forEach((control) => {
            const staysInteractive = control === menuToggle || control === themeToggle;
            control.toggleAttribute("inert", isInert && !staysInteractive);
          });
        return;
      }

      element.toggleAttribute("inert", isInert);
    });
  };

  const preventBackgroundScroll = (event) => {
    if (!menuIsOpen || (event.target instanceof Element && sideMenu?.contains(event.target))) {
      return;
    }

    event.preventDefault();
  };

  const addMenuScrollLockListeners = () => {
    document.addEventListener("wheel", preventBackgroundScroll, { passive: false });
    document.addEventListener("touchmove", preventBackgroundScroll, { passive: false });
  };

  const removeMenuScrollLockListeners = () => {
    document.removeEventListener("wheel", preventBackgroundScroll);
    document.removeEventListener("touchmove", preventBackgroundScroll);
  };

  const openMenu = () => {
    if (!menuToggle || !sideMenu || menuIsOpen) {
      return;
    }

    syncHeaderHeight();
    updateActiveNav();
    lockBodyScroll();
    menuOpener = menuToggle;
    menuIsOpen = true;
    body.classList.add("menu-open");
    syncMenuToggle();
    setBackgroundInert(true);
    addMenuScrollLockListeners();
    syncHeroSymbolAnimation();

    menuToggle.focus({ preventScroll: true });
  };

  const closeMenu = (options = {}) => {
    const { restoreFocus = true } = options;

    if (!menuToggle || !sideMenu || !menuIsOpen) {
      return false;
    }

    body.classList.remove("menu-open");
    menuIsOpen = false;
    syncMenuToggle();
    setBackgroundInert(false);
    removeMenuScrollLockListeners();
    syncHeroSymbolAnimation();
    unlockBodyScroll();

    const focusTarget = menuOpener?.isConnected ? menuOpener : menuToggle;
    menuOpener = null;

    if (restoreFocus) {
      focusTarget?.focus({ preventScroll: true });
    }

    return true;
  };

  const setNewsPanelInert = (panel, isInert) => {
    if (isInert) {
      panel.setAttribute("inert", "");
      return;
    }

    panel.removeAttribute("inert");
  };

  const setNewsCardState = (card, toggle, panel, isExpanded) => {
    const title =
      card.querySelector(".news-card__title")?.textContent.trim() ||
      "\u043D\u043E\u0432\u043E\u0441\u0442\u0438";
    const nextLabel = `${isExpanded ? "\u0421\u0432\u0435\u0440\u043D\u0443\u0442\u044C" : "\u0420\u0430\u0437\u0432\u0435\u0440\u043D\u0443\u0442\u044C"} \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043D\u043E\u0432\u043E\u0441\u0442\u0438 \u00AB${title}\u00BB`;

    card.classList.toggle("is-expanded", isExpanded);
    toggle.setAttribute("aria-expanded", String(isExpanded));
    toggle.setAttribute("aria-label", nextLabel);
    panel.setAttribute("aria-hidden", String(!isExpanded));
    setNewsPanelInert(panel, !isExpanded);
  };

  const toggleNewsCard = (card, toggle, panel) => {
    const isExpanded = toggle.getAttribute("aria-expanded") === "true";
    const shouldExpand = !isExpanded;

    if (shouldReduceMotion()) {
      setNewsCardState(card, toggle, panel, shouldExpand);
      panel.style.height = shouldExpand ? "auto" : "0px";
      scheduleHeaderSync();
      return;
    }

    const currentHeight = panel.getBoundingClientRect().height;

    panel.style.height = `${currentHeight}px`;
    panel.getBoundingClientRect();
    setNewsCardState(card, toggle, panel, shouldExpand);

    const targetHeight = shouldExpand ? panel.scrollHeight : 0;

    const syncOpenHeight = (event) => {
      if (event.target !== panel || event.propertyName !== "height") {
        return;
      }

      panel.removeEventListener("transitionend", syncOpenHeight);

      if (toggle.getAttribute("aria-expanded") === "true") {
        panel.style.height = "auto";
      }

      scheduleHeaderSync();
    };

    panel.addEventListener("transitionend", syncOpenHeight);

    window.requestAnimationFrame(() => {
      panel.style.height = `${targetHeight}px`;
    });
  };

  const initNewsCards = () => {
    if (newsCards.length === 0) {
      return;
    }

    newsCards.forEach((card) => {
      const toggle = card.querySelector(".news-card__toggle");
      const panel = card.querySelector("[data-news-details]");

      if (!toggle || !panel) {
        return;
      }

      setNewsCardState(card, toggle, panel, toggle.getAttribute("aria-expanded") === "true");
      panel.style.height = toggle.getAttribute("aria-expanded") === "true" ? "auto" : "0px";

      toggle.addEventListener("click", () => {
        toggleNewsCard(card, toggle, panel);
      });

    });
  };

  const initTheme = () => {
    setTheme(getSavedTheme() || root.dataset.theme || getSystemTheme(), false);

    themeToggle?.addEventListener("click", () => {
      const nextTheme = root.dataset.theme === "light" ? "dark" : "light";
      setThemeWithTransition(nextTheme, true);
      scheduleHeaderSync();
    });
  };

  const initHeaderMetrics = () => {
    syncScrollMetrics();

    window.addEventListener("resize", scheduleHeaderSync);
    window.addEventListener("orientationchange", scheduleHeaderSync);
    window.addEventListener("load", scheduleHeaderSync, { once: true });
    document.fonts?.ready.then(scheduleHeaderSync);
  };

  const initMenu = () => {
    if (menuToggle && sideMenu) {
      menuToggle.addEventListener("click", () => {
        if (menuIsOpen) {
          closeMenu();
          return;
        }

        openMenu();
      });
    }

    overlay?.addEventListener("click", () => {
      closeMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menuIsOpen) {
        closeMenu();
        return;
      }

      if (event.key === "Tab" && menuIsOpen) {
        const focusableElements = getMenuFocusableElements();

        if (focusableElements.length === 0) {
          event.preventDefault();
          sideMenu?.focus({ preventScroll: true });
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        if (!focusableElements.includes(activeElement)) {
          event.preventDefault();
          (event.shiftKey ? lastElement : firstElement).focus({ preventScroll: true });
          return;
        }

        if (event.shiftKey && activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus({ preventScroll: true });
          return;
        }

        if (!event.shiftKey && activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus({ preventScroll: true });
        }

        return;
      }

      const targetIsInteractive =
        event.target instanceof Element &&
        Boolean(
          event.target.closest(
            "a, button, input, select, textarea, [contenteditable='true']"
          )
        );

      if (
        menuIsOpen &&
        (event.key === "ArrowUp" ||
          event.key === "ArrowDown" ||
          event.key === "PageUp" ||
          event.key === "PageDown" ||
          event.key === "Home" ||
          event.key === "End" ||
          event.key === " ") &&
        !targetIsInteractive &&
        (!(event.target instanceof Element) || !event.target.closest(".side-menu__nav"))
      ) {
        event.preventDefault();
      }
    });
  };

  const initHashScrolling = () => {
    document.querySelectorAll('a[href*="#"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        const href = link.getAttribute("href");
        if (!href) {
          return;
        }

        const url = new URL(href, window.location.href);
        const isSamePage =
          url.origin === window.location.origin && url.pathname === window.location.pathname;
        if (!isSamePage || !url.hash) {
          return;
        }

        const target = getTargetFromHash(url.hash);
        if (!target) {
          return;
        }

        event.preventDefault();

        const performScroll = () => {
          scrollToHash(url.hash, { behavior: "smooth", historyMode: "push" });
          scheduleActiveNavUpdate();
        };

        if (menuIsOpen) {
          closeMenu();
          scheduleNavigationScroll(performScroll);
          return;
        }

        performScroll();
      });
    });

    // Re-scrolling on `load` used to override a user's first wheel/touch input
    // after slow assets finished loading. The head bootstrap suppresses only the
    // browser's initial anchor jump; this restores the URL once and scrolls only
    // if no manual input has happened. Back/Forward remains browser-managed after
    // initialization.
    const initialHash = window.__snakeInitialHash;

    if (initialHash) {
      history.replaceState(
        history.state,
        "",
        `${window.location.pathname}${window.location.search}${initialHash}`
      );
      window.__snakeInitialHash = "";

      if (!window.__snakeManualScroll) {
        withInstantScroll(() => {
          scrollToHash(initialHash, { behavior: "auto", historyMode: "none" });
        });
      }

      scheduleActiveNavUpdate();
    }

    // CSS scroll-margin keeps native Back/Forward anchor positioning clear of
    // the sticky header without scheduling another programmatic scroll.
    window.addEventListener("wheel", cancelProgrammaticNavigation, { passive: true });
    window.addEventListener("touchmove", cancelProgrammaticNavigation, { passive: true });
    window.addEventListener("pointerdown", cancelProgrammaticNavigation, { passive: true });
    window.addEventListener("keydown", (event) => {
      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "PageUp" ||
        event.key === "PageDown" ||
        event.key === "Home" ||
        event.key === "End" ||
        event.key === " "
      ) {
        cancelProgrammaticNavigation();
      }
    });
  };

  const initPageTransitions = () => {
    window.addEventListener("pageshow", () => {
      window.clearTimeout(pageNavigationTimer);
      pageNavigationTimer = 0;
      body.classList.remove("page-is-leaving");
    });

    document.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      ) {
        return;
      }

      const link = event.target.closest("a[href]");
      if (
        !link ||
        link.hasAttribute("download") ||
        (link.target && link.target.toLowerCase() !== "_self")
      ) {
        return;
      }

      const url = new URL(link.href, window.location.href);
      const isSameDocument =
        url.origin === window.location.origin &&
        url.pathname === window.location.pathname &&
        url.search === window.location.search;

      if (url.origin !== window.location.origin || isSameDocument) {
        return;
      }

      event.preventDefault();
      cancelProgrammaticNavigation();

      if (menuIsOpen) {
        closeMenu();
      }

      const navigate = () => {
        pageNavigationTimer = 0;
        window.location.assign(url.href);
      };

      if (shouldReduceMotion()) {
        navigate();
        return;
      }

      body.classList.add("page-is-leaving");
      pageNavigationTimer = window.setTimeout(navigate, PAGE_EXIT_DURATION);
    });
  };

  const initScrollRestoration = () => {
    window.addEventListener("pageshow", (event) => {
      if (!event.persisted) {
        return;
      }

      if (menuIsOpen) {
        closeMenu();
        return;
      }

      scheduleHeaderSync();
    });

    window.addEventListener("pagehide", () => {
      if (menuIsOpen) {
        closeMenu();
      }
    });
  };

  const initBackToTop = () => {
    if (!backToTop) {
      return;
    }

    let backToTopFrame = 0;
    let backToTopIsVisible = backToTop.classList.contains("is-visible");

    const toggleBackToTop = () => {
      backToTopFrame = 0;
      const shouldBeVisible = getScrollY() > 0;

      if (shouldBeVisible === backToTopIsVisible) {
        return;
      }

      backToTopIsVisible = shouldBeVisible;
      backToTop.classList.toggle("is-visible", shouldBeVisible);
    };

    const scheduleBackToTopUpdate = () => {
      if (backToTopFrame) {
        return;
      }

      backToTopFrame = window.requestAnimationFrame(toggleBackToTop);
    };

    backToTop.addEventListener("click", () => {
      const goToTop = () => {
        scrollToHash("#top", { behavior: "smooth", historyMode: "push" });
      };

      if (menuIsOpen) {
        closeMenu();
        scheduleNavigationScroll(goToTop);
        return;
      }

      goToTop();
    });

    toggleBackToTop();
    window.addEventListener("scroll", scheduleBackToTopUpdate, { passive: true });
  };

  const initHomePageNavigation = () => {
    updateActiveNav();

    if (isHomePage) {
      window.addEventListener("scroll", scheduleActiveNavUpdate, { passive: true });
    }
  };

  const initPage = () => {
    initTheme();
    initHeaderMetrics();
    initHomePageNavigation();
    initHeroSymbolAnimation();
    initNewsCards();
    initMenu();
    initPageTransitions();
    initHashScrolling();
    initScrollRestoration();
    initBackToTop();
  };

  initPage();
})();
