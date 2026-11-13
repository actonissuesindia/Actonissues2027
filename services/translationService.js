const axios = require('axios');

// The 7 non-English languages the site supports (see src/context/LanguageContext.jsx's
// LANGUAGES — 'en' is the source language, never a translation target).
const TARGET_LANGUAGES = ['hi', 'te', 'ta', 'mr', 'or', 'ml', 'kn'];

// Lazy — a missing key should never crash article/page-block saving, only
// mean translations don't get generated (same pattern as pushService's VAPID
// check). Checked fresh each call rather than cached, since there's no
// meaningful "configure once" step beyond having the env var.
function isConfigured() {
  return !!process.env.GOOGLE_TRANSLATE_API_KEY;
}

// Translates every value in `fields` (a flat { key: 'text or html' } object)
// into a single target language with ONE API call — Cloud Translation v2
// accepts an array for `q`, so batching every field together (rather than
// one call per field) is what keeps this to 7 calls total per save instead
// of 7 × field-count. `format: 'html'` is used even for plain-text fields
// (title, excerpt) — safe, since text with no markup just passes through
// unchanged, and it's required for `body` to keep its tags intact.
async function translateOne(fields, target) {
  const keys = Object.keys(fields).filter(k => fields[k]);
  if (keys.length === 0) return {};
  const { data } = await axios.post(
    `https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_TRANSLATE_API_KEY}`,
    { q: keys.map(k => fields[k]), source: 'en', target, format: 'html' }
  );
  const translated = data.data.translations;
  const result = {};
  keys.forEach((k, i) => { result[k] = translated[i]?.translatedText; });
  return result;
}

// Returns { hi: {...fields translated...}, te: {...}, ... } — one entry per
// supported language, or {} if the API key isn't configured. A single
// language's failure (e.g. a transient API error) is logged and that
// language is simply left out of the result rather than failing the whole
// batch — callers already fall back to English for any language missing
// from this object (see controllers/articleController.js).
exports.translateFields = async (fields) => {
  if (!isConfigured()) return {};
  const entries = await Promise.all(TARGET_LANGUAGES.map(async (lang) => {
    try {
      return [lang, await translateOne(fields, lang)];
    } catch (err) {
      console.error(`Translation to "${lang}" failed:`, err.message);
      return [lang, null];
    }
  }));
  return Object.fromEntries(entries.filter(([, v]) => v !== null));
};

exports.TARGET_LANGUAGES = TARGET_LANGUAGES;

// Every language the site supports as a viewing language — unlike
// TARGET_LANGUAGES above, this includes 'en', because user-submitted issue
// text (unlike Articles/PageBlocks) isn't always authored in English, so
// English itself can be a translation *target* here.
const ALL_LANGUAGES = ['en', ...TARGET_LANGUAGES];

// Same one-call-per-target batching as translateOne, but `source` is
// omitted so Cloud Translation auto-detects the input language instead of
// assuming English — needed for user-submitted issue text. Returns both
// the translated fields and whichever source language Google detected.
// format: 'text' (not 'html' like translateOne above) — issue title/
// description are always plain textarea text, never real HTML, and
// format: 'html' treats a bare '\n' as insignificant whitespace and
// collapses it, silently flattening a multi-paragraph report into one
// run-on paragraph in every language except whichever one the reporter
// actually typed it in.
async function translateAuto(fields, target) {
  const keys = Object.keys(fields).filter(k => fields[k]);
  if (keys.length === 0) return { fields: {}, detected: null };
  const { data } = await axios.post(
    `https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_TRANSLATE_API_KEY}`,
    { q: keys.map(k => fields[k]), target, format: 'text' }
  );
  const translated = data.data.translations;
  const result = {};
  keys.forEach((k, i) => { result[k] = translated[i]?.translatedText; });
  return { fields: result, detected: translated[0]?.detectedSourceLanguage || null };
}

// Translates user-submitted fields (e.g. an issue's title/description) into
// every OTHER language the site supports than whichever one they were
// actually written in — the source language is auto-detected rather than
// assumed, since issue authors aren't restricted to English the way
// article writers are expected to be. Returns
// { detectedLanguage: 'ta', translations: { en: {...}, hi: {...}, ... } }
// (no entry for 'ta' itself — that's just the original text), or
// { detectedLanguage: null, translations: {} } if unconfigured or the
// initial detection call fails.
exports.translateIssueFields = async (fields) => {
  if (!isConfigured()) return { detectedLanguage: null, translations: {} };

  // The English call doubles as language detection — every supported UI
  // defaults to English, so it's translated first regardless of how many
  // of the other 6 languages end up succeeding.
  let enResult;
  try {
    enResult = await translateAuto(fields, 'en');
  } catch (err) {
    console.error('Issue translation (detect + en) failed:', err.message);
    return { detectedLanguage: null, translations: {} };
  }
  const detectedLanguage = enResult.detected || 'en';
  const translations = {};
  if (detectedLanguage !== 'en') translations.en = enResult.fields;

  const remaining = ALL_LANGUAGES.filter(l => l !== 'en' && l !== detectedLanguage);
  const entries = await Promise.all(remaining.map(async (lang) => {
    try {
      return [lang, (await translateAuto(fields, lang)).fields];
    } catch (err) {
      console.error(`Issue translation to "${lang}" failed:`, err.message);
      return [lang, null];
    }
  }));
  entries.forEach(([lang, v]) => { if (v !== null) translations[lang] = v; });

  return { detectedLanguage, translations };
};

exports.ALL_LANGUAGES = ALL_LANGUAGES;
