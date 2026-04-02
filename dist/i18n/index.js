const _v = new URL(import.meta.url).search;
const { default: EN } = await import(`./en.js${_v}`);
const { default: DE } = await import(`./de.js${_v}`);

const DICTS = { en: EN, de: DE };

function resolveLang(hass) {
  const raw =
    (hass && (hass.locale?.language || hass.language)) ||
    (typeof navigator !== "undefined" ? navigator.language : "en") ||
    "en";
  const base = String(raw).toLowerCase();
  if (DICTS[base]) return base;
  const short = base.split("-")[0];
  return DICTS[short] ? short : "en";
}

function fmt(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] != null ? String(vars[k]) : `{${k}}`
  );
}

export function t(hass, key, vars) {
  const lang = resolveLang(hass);
  const dict = DICTS[lang] || DICTS.en;
  const base = dict[key] ?? DICTS.en[key] ?? key;
  return fmt(base, vars);
}

export { DICTS };
