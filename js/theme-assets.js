import chiefLight from "../assets/responsive/leadership/chief.webp";
import chiefDark from "../assets/responsive/leadership/chief-dark.webp";
import closeLight from "../assets/icons/close.svg";
import closeDark from "../assets/icons/close-dark.svg";
import darkMode from "../assets/icons/dark-mode.svg";
import hamburgerLight from "../assets/icons/hamburger.svg";
import hamburgerDark from "../assets/icons/hamburger-dark.svg";
import lightMode from "../assets/icons/light-mode.svg";
import iconLight from "../assets/icon.svg";
import iconDark from "../assets/icon-dark.svg";
import logoLight310 from "../assets/responsive/logo-310/logo-transparent.webp";
import logoLight460 from "../assets/responsive/logo-460/logo-transparent.webp";
import logoLight620 from "../assets/responsive/logo-620/logo-transparent.webp";
import logoLight920 from "../assets/responsive/logo-920/logo-transparent.webp";
import logoDark310 from "../assets/responsive/logo-310/logo-transparent-dark.webp";
import logoDark460 from "../assets/responsive/logo-460/logo-transparent-dark.webp";
import logoDark620 from "../assets/responsive/logo-620/logo-transparent-dark.webp";
import logoDark920 from "../assets/responsive/logo-920/logo-transparent-dark.webp";
import newsAvatar0Light160 from "../assets/responsive/news-160/news-avatar-0.webp";
import newsAvatar0Light320 from "../assets/responsive/news-320/news-avatar-0.webp";
import newsAvatar0Dark160 from "../assets/responsive/news-160/news-avatar-0-dark.webp";
import newsAvatar0Dark320 from "../assets/responsive/news-320/news-avatar-0-dark.webp";
import newsAvatar1Light160 from "../assets/responsive/news-160/news-avatar-1.webp";
import newsAvatar1Light320 from "../assets/responsive/news-320/news-avatar-1.webp";
import newsAvatar1Dark160 from "../assets/responsive/news-160/news-avatar-1-dark.webp";
import newsAvatar1Dark320 from "../assets/responsive/news-320/news-avatar-1-dark.webp";
import newsAvatar2Light160 from "../assets/responsive/news-160/news-avatar-2.webp";
import newsAvatar2Light320 from "../assets/responsive/news-320/news-avatar-2.webp";
import newsAvatar2Dark160 from "../assets/responsive/news-160/news-avatar-2-dark.webp";
import newsAvatar2Dark320 from "../assets/responsive/news-320/news-avatar-2-dark.webp";
import newsAvatar3Light160 from "../assets/responsive/news-160/news-avatar-3.webp";
import newsAvatar3Light320 from "../assets/responsive/news-320/news-avatar-3.webp";
import newsAvatar3Dark160 from "../assets/responsive/news-160/news-avatar-3-dark.webp";
import newsAvatar3Dark320 from "../assets/responsive/news-320/news-avatar-3-dark.webp";
import newsAvatar4Light160 from "../assets/responsive/news-160/news-avatar-4.webp";
import newsAvatar4Light320 from "../assets/responsive/news-320/news-avatar-4.webp";
import newsAvatar4Dark160 from "../assets/responsive/news-160/news-avatar-4-dark.webp";
import newsAvatar4Dark320 from "../assets/responsive/news-320/news-avatar-4-dark.webp";
import telegramLight from "../assets/telegram.svg";
import telegramDark from "../assets/telegram-dark.svg";
import viceChiefLight from "../assets/responsive/leadership/vice-chief.webp";
import viceChiefDark from "../assets/responsive/leadership/vice-chief-dark.webp";

export const THEME_ASSETS = Object.freeze({
  "chief-light": chiefLight,
  "chief-dark": chiefDark,
  "close-light": closeLight,
  "close-dark": closeDark,
  "dark-mode": darkMode,
  "hamburger-light": hamburgerLight,
  "hamburger-dark": hamburgerDark,
  "light-mode": lightMode,
  "icon-light": iconLight,
  "icon-dark": iconDark,
  "logo-light": logoLight920,
  "logo-dark": logoDark920,
  "logo-light-srcset": `${logoLight310} 310w, ${logoLight460} 460w, ${logoLight620} 620w, ${logoLight920} 920w`,
  "logo-dark-srcset": `${logoDark310} 310w, ${logoDark460} 460w, ${logoDark620} 620w, ${logoDark920} 920w`,
  "news-avatar-0-light": newsAvatar0Light320,
  "news-avatar-0-dark": newsAvatar0Dark320,
  "news-avatar-0-light-srcset": `${newsAvatar0Light160} 160w, ${newsAvatar0Light320} 320w`,
  "news-avatar-0-dark-srcset": `${newsAvatar0Dark160} 160w, ${newsAvatar0Dark320} 320w`,
  "news-avatar-1-light": newsAvatar1Light320,
  "news-avatar-1-dark": newsAvatar1Dark320,
  "news-avatar-1-light-srcset": `${newsAvatar1Light160} 160w, ${newsAvatar1Light320} 320w`,
  "news-avatar-1-dark-srcset": `${newsAvatar1Dark160} 160w, ${newsAvatar1Dark320} 320w`,
  "news-avatar-2-light": newsAvatar2Light320,
  "news-avatar-2-dark": newsAvatar2Dark320,
  "news-avatar-2-light-srcset": `${newsAvatar2Light160} 160w, ${newsAvatar2Light320} 320w`,
  "news-avatar-2-dark-srcset": `${newsAvatar2Dark160} 160w, ${newsAvatar2Dark320} 320w`,
  "news-avatar-3-light": newsAvatar3Light320,
  "news-avatar-3-dark": newsAvatar3Dark320,
  "news-avatar-3-light-srcset": `${newsAvatar3Light160} 160w, ${newsAvatar3Light320} 320w`,
  "news-avatar-3-dark-srcset": `${newsAvatar3Dark160} 160w, ${newsAvatar3Dark320} 320w`,
  "news-avatar-4-light": newsAvatar4Light320,
  "news-avatar-4-dark": newsAvatar4Dark320,
  "news-avatar-4-light-srcset": `${newsAvatar4Light160} 160w, ${newsAvatar4Light320} 320w`,
  "news-avatar-4-dark-srcset": `${newsAvatar4Dark160} 160w, ${newsAvatar4Dark320} 320w`,
  "telegram-light": telegramLight,
  "telegram-dark": telegramDark,
  "vice-chief-light": viceChiefLight,
  "vice-chief-dark": viceChiefDark,
});

export const resolveThemeAsset = (assetKey) => {
  const assetUrl = THEME_ASSETS[assetKey];

  if (assetUrl) {
    return assetUrl;
  }

  if (import.meta.env.DEV) {
    console.error(`[theme-assets] Unknown theme asset ID: "${String(assetKey)}".`);
  }

  return null;
};
