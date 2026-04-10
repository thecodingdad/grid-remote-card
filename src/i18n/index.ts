/**
 * i18n loader — bundled into the main card output.
 *
 * Earlier revisions kept en.js and de.js as separate deployable files
 * with a cache-bust query string injected from the main card version.
 * That split bought nothing for a single-bundle TS card (translations
 * are tiny, rebuild is fast) and broke cache-busting because query
 * strings cannot be injected into static imports. Now the dicts are
 * statically imported and included in the main bundle — cache-busting
 * is handled entirely by the `?v=<hash>` query on the main card URL.
 */

import EN from './en';
import DE from './de';

export type Dict = Record<string, string>;

interface HassLike {
  locale?: { language?: string };
  language?: string;
}

const DICTS: Record<string, Dict> = { en: EN as Dict, de: DE as Dict };

function resolveLang(hass: HassLike | undefined): string {
  const raw =
    (hass && (hass.locale?.language || hass.language)) ||
    (typeof navigator !== 'undefined' ? navigator.language : 'en') ||
    'en';
  const base = String(raw).toLowerCase();
  if (DICTS[base]) return base;
  const short = base.split('-')[0];
  return DICTS[short] ? short : 'en';
}

function fmt(str: string, vars: Record<string, string | number> | undefined): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_match, k) =>
    vars[k] != null ? String(vars[k]) : `{${k}}`,
  );
}

export function t(
  hass: HassLike | undefined,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const lang = resolveLang(hass);
  const dict = DICTS[lang] || DICTS.en;
  const base = dict[key] ?? DICTS.en[key] ?? key;
  return fmt(base, vars);
}

export { DICTS };
