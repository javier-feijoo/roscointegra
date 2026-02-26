const I18N_STORAGE_KEY = "roscointegra.lang";
let currentTranslations = {};

async function fetchTranslations(lang) {
  try {
    const response = await fetch(`lang/${lang}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load ${lang}.json`);
    }
    return await response.json();
  } catch (error) {
    console.error("Translation fetch error:", error);
    return {};
  }
}

export function t(key, vars = {}) {
  const template = currentTranslations[key] || key;
  return template.replace(/\{(\w+)\}/g, (_m, token) => {
    if (Object.prototype.hasOwnProperty.call(vars, token)) {
      return String(vars[token]);
    }
    return `{${token}}`;
  });
}

export function updateUI() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key) {
      // For elements like <p> or <span> that have direct text content
      if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
        el.textContent = t(key);
      } else {
        // For elements that contain other elements, like <strong>
        const strong = el.querySelector("strong");
        if (strong) {
          strong.textContent = t(key);
        } else {
            el.textContent = t(key);
        }
      }
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key) {
      el.setAttribute("placeholder", t(key));
    }
  });

  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    if (key) {
      el.setAttribute("title", t(key));
    }
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria-label");
    if (key) {
      el.setAttribute("aria-label", t(key));
    }
  });
}

export async function setLanguage(lang) {
  if (!lang) {
    lang = getLanguage();
  }
  currentTranslations = await fetchTranslations(lang);
  document.documentElement.lang = lang;
  localStorage.setItem(I18N_STORAGE_KEY, lang);
  updateUI();
  document.dispatchEvent(new CustomEvent("roscointegra:language-changed", { detail: { lang } }));
}

export function getLanguage() {
  return localStorage.getItem(I18N_STORAGE_KEY) || "es";
}
