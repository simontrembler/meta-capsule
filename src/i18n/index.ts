import { fr, type TranslationKey } from './fr';
import { en } from './en';
import type { Locale } from './fr';

export type { Locale, TranslationKey };
export { fr, en };

export const dictionaries: Record<Locale, Record<TranslationKey, string>> = {
  fr: fr as Record<TranslationKey, string>,
  en
};

export const LOCALE_STORAGE_KEY = 'meta_capsule_lang';

export function getDateLocale(locale: Locale): string {
  return locale === 'fr' ? 'fr-FR' : 'en-US';
}

export function translate(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>
): string {
  let text = dictionaries[locale][key] ?? dictionaries.fr[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
