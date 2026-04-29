(function () {
  const FALLBACK_THEME = "dark";
  const THEME_COLORS = {
    dark: "#08131f",
    light: "#f6f8f3",
  };

  const getSystemTheme = () => {
    if (window.matchMedia?.("(prefers-color-scheme: light)").matches) {
      return "light";
    }

    return FALLBACK_THEME;
  };

  const getSavedTheme = () => {
    try {
      const savedTheme = localStorage.getItem("theme");
      return savedTheme === "light" || savedTheme === "dark" ? savedTheme : null;
    } catch (error) {
      return null;
    }
  };

  const setThemeColor = (theme) => {
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeMeta) {
      return;
    }

    themeMeta.setAttribute("content", THEME_COLORS[theme] || THEME_COLORS[FALLBACK_THEME]);
  };

  const theme = getSavedTheme() || getSystemTheme();
  document.documentElement.dataset.theme = theme;
  setThemeColor(theme);
})();
