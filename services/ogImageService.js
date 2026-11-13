const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Jimp, JimpMime } = require('jimp');

// Rendering is pure JavaScript and genuinely slow — measured at 7.5s for the
// first request to a real phone photo on Cloud Run, which is far longer than
// any link-preview crawler waits. The in-memory cache below only helps the
// second visitor to a given post, and only while that container lives: Cloud
// Run scales to zero, so in practice the *first* share of a post — the one
// that decides the preview everyone else sees, since crawlers cache what they
// get — almost always paid the full render. Finished cards are therefore also
// written to the same bucket the photos live in, keyed by what they were
// derived from, so a card is rendered once for the life of the photo rather
// than once per container.
const useGCS = !!process.env.GCS_BUCKET;
const gcs = useGCS ? require('./gcsService') : null;

const storedCardName = (sourceUrl, portrait) => {
  const key = crypto.createHash('sha1').update(`${portrait ? 'portrait' : 'cover'}:${sourceUrl}`).digest('hex');
  return `og-cards/${key}.jpg`;
};

// Why this exists: a shared link only looks the same everywhere if the
// og:image behind it is always the same shape and always small enough for the
// crawler to actually download. Pointing og:image straight at an attachment
// failed both tests — a phone photo is up to 10MB (WhatsApp gives up long
// before that and falls back to a bare, text-only card), its aspect ratio is
// whatever the camera produced, and an .mp4/.mov attachment isn't an image at
// all. So every preview is rendered here instead: one fixed 1200x630 JPEG per
// link, a couple of hundred KB, generated once and cached.
const WIDTH = 1200;
const HEIGHT = 630;
const QUALITY = 80;

// Anything bigger than this almost certainly isn't a phone photo worth
// decoding (the upload cap is 10MB — see middleware/upload.js), and decoding
// is the one genuinely memory-hungry step: Jimp holds the source as raw RGBA,
// so a 12MP photo is ~48MB of heap while it's being resized.
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8000;

// Rendered cards are ~150KB each, so this ceiling costs well under 20MB of
// heap while sparing repeat crawlers (every share of the same link, every
// re-scrape) the decode.
const CACHE_MAX = 120;
const cache = new Map();
// Two crawlers hitting the same fresh link at once (common — WhatsApp and the
// recipient's own client) would otherwise both decode the same photo.
const inFlight = new Map();

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'];

// Issue attachments accept video too (.mp4/.mov — see middleware/upload.js),
// and the first attachment is often the video: handing that URL to a crawler
// as og:image is exactly how a post ends up previewing with no picture at all.
//
// Phrased as "not a video" rather than "has a known image extension" on
// purpose. Not every stored URL carries an extension (an externally hosted
// cover image pasted in by an admin, for one), and refusing those would drop a
// perfectly good picture. Anything that gets through but turns out not to be
// decodable falls back to the branded card in cardFor below, so the cost of
// guessing generously is one wasted fetch.
const isImageUrl = (url) => {
  if (!url) return false;
  const clean = String(url).split('?')[0].toLowerCase();
  return !VIDEO_EXTENSIONS.some(ext => clean.endsWith(ext));
};

// The first attachment that's actually a picture, not just the first one.
exports.pickPreviewImage = (attachments = []) => (attachments || [])
  .map(a => a?.url)
  .find(isImageUrl) || null;

// Attachment URLs come in two shapes depending on deployment: an absolute
// https://storage.googleapis.com/... one when GCS is configured, or a local
// "/uploads/xyz.jpg" one when it isn't (see controllers/attachmentController).
// A stored URL isn't always one this server uploaded — an article's cover
// image can be an address someone typed into the admin panel. Fetching a
// private address on this container's behalf is the classic server-side
// request forgery shape (cloud metadata endpoints live on 169.254.169.254),
// so only public hosts are ever dialled.
const PRIVATE_HOST = /^(localhost$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|0\.)/i;

const loadSource = async (url) => {
  if (url.startsWith('/uploads/')) {
    // basename() only — a stored name like "../../.env" would otherwise read
    // straight out of the uploads directory.
    const file = path.join(__dirname, '..', 'uploads', path.basename(url));
    return fs.promises.readFile(file);
  }
  if (!/^https?:\/\//i.test(url)) throw new Error(`Unsupported image URL: ${url}`);
  if (PRIVATE_HOST.test(new URL(url).hostname)) throw new Error(`Refusing to fetch a private address: ${url}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
  const declared = Number(res.headers.get('content-length'));
  if (declared && declared > MAX_SOURCE_BYTES) throw new Error('Source image too large');
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_SOURCE_BYTES) throw new Error('Source image too large');
  return buffer;
};

// Jimp has no rounded-rectangle primitive, so the badge plate is drawn by
// hand: a solid block with the four corners cleared to a quarter-circle.
const roundedPlate = (w, h, radius, color) => {
  const plate = new Jimp({ width: w, height: h, color });
  plate.scan(0, 0, w, h, (x, y, idx) => {
    const cx = x < radius ? radius : (x >= w - radius ? w - radius - 1 : x);
    const cy = y < radius ? radius : (y >= h - radius ? h - radius - 1 : y);
    if ((x - cx) ** 2 + (y - cy) ** 2 > radius ** 2) plate.bitmap.data[idx + 3] = 0;
  });
  return plate;
};

const readLogo = async () => Jimp.read(path.join(__dirname, '..', 'public', 'og-logo.png'));

// A small wordmark plate in the corner of every photo card. It's what makes a
// forwarded screenshot-able preview recognisable as this site rather than an
// anonymous photo, and it's the same mark the no-photo card below is built
// from, so the two read as one family.
const stampLogo = async (card) => {
  const logo = await readLogo();
  const logoWidth = 216;
  logo.resize({ w: logoWidth, h: Math.round(logo.height * (logoWidth / logo.width)) });
  const padX = 22;
  const padY = 16;
  const plate = roundedPlate(logo.width + padX * 2, logo.height + padY * 2, 18, 0xffffffe8);
  const x = 40;
  const y = HEIGHT - plate.height - 40;
  card.composite(plate, x, y);
  card.composite(logo, x + padX, y + padY);
};

const renderPhotoCard = async (sourceUrl) => {
  const image = await Jimp.read(await loadSource(sourceUrl));
  // cover, not contain: the card is always filled edge to edge, so a portrait
  // phone photo and a landscape one produce the same shaped preview instead of
  // one of them arriving letterboxed.
  image.cover({ w: WIDTH, h: HEIGHT });
  await stampLogo(image);
  return image.getBuffer(JimpMime.jpeg, { quality: QUALITY });
};

// The fallback card — used for a post with no photo, a video-only post, an
// article with no cover, and every static page. Without it those links fall
// back to whatever the messaging app invents (usually just the bare domain
// name), which is the single biggest reason shares looked different from
// each other.
let defaultCardPromise = null;

const buildBackground = () => {
  const card = new Jimp({ width: WIDTH, height: HEIGHT, color: 0xffffffff });
  // A soft top-to-bottom wash rather than flat white, so the card still reads
  // as a designed surface on both light and dark chat backgrounds.
  card.scan(0, 0, WIDTH, HEIGHT, (x, y, idx) => {
    const t = y / HEIGHT;
    card.bitmap.data[idx] = Math.round(255 - 11 * t);
    card.bitmap.data[idx + 1] = Math.round(255 - 8 * t);
    card.bitmap.data[idx + 2] = Math.round(255 - 2 * t);
  });

  // The brand gradient (violet -> blue -> teal, the logo's own ramp) as a bar
  // across the bottom edge.
  const stops = [[109, 40, 217], [37, 99, 235], [16, 185, 129]];
  const barHeight = 16;
  card.scan(0, HEIGHT - barHeight, WIDTH, barHeight, (x, y, idx) => {
    const t = (x / WIDTH) * (stops.length - 1);
    const i = Math.min(Math.floor(t), stops.length - 2);
    const f = t - i;
    for (let c = 0; c < 3; c += 1) {
      card.bitmap.data[idx + c] = Math.round(stops[i][c] + (stops[i + 1][c] - stops[i][c]) * f);
    }
  });

  return card;
};

const renderDefaultCard = async () => {
  const card = buildBackground();
  const logo = await readLogo();
  const logoWidth = 720;
  logo.resize({ w: logoWidth, h: Math.round(logo.height * (logoWidth / logo.width)) });
  card.composite(logo, Math.round((WIDTH - logo.width) / 2), Math.round((HEIGHT - logo.height) / 2) - 10);

  return card.getBuffer(JimpMime.jpeg, { quality: QUALITY });
};

// For a source that isn't a landscape photo — a profile picture, which is
// square or portrait. Cover-cropping one of those to a 1.91:1 card slices a
// band out of the middle of someone's face, so it's centred whole on the same
// branded background instead.
const renderPortraitCard = async (sourceUrl) => {
  const image = await Jimp.read(await loadSource(sourceUrl));
  const box = 430;
  image.contain({ w: box, h: box });
  const card = buildBackground();
  card.composite(image, Math.round((WIDTH - box) / 2), Math.round((HEIGHT - box) / 2) - 12);
  await stampLogo(card);
  return card.getBuffer(JimpMime.jpeg, { quality: QUALITY });
};

exports.defaultCard = () => {
  // Built once per process, not per request — it never changes.
  if (!defaultCardPromise) {
    defaultCardPromise = renderDefaultCard().catch((err) => {
      // Don't cache a failure forever; the next request retries.
      defaultCardPromise = null;
      throw err;
    });
  }
  return defaultCardPromise;
};

const remember = (key, buffer) => {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, buffer);
};

// The one entry point routes use: hand it a source photo (or nothing) and
// always get a valid card back. The source URL doubles as the cache key —
// every uploaded file gets a unique name, so a replaced photo is a new key
// rather than a stale hit. Any failure — unreachable bucket, corrupt file,
// unsupported format — degrades to the branded card rather than a broken
// og:image, because a crawler gets exactly one attempt and a 404 there is a
// preview that never recovers.
// Three places a finished card can come from, cheapest first: this
// container's memory, the bucket (rendered by some earlier container, maybe
// weeks ago), or a fresh render — which then goes to both so nothing renders
// the same photo twice.
const buildCard = async (sourceUrl, portrait) => {
  const storedName = useGCS ? storedCardName(sourceUrl, portrait) : null;
  if (storedName) {
    const stored = await gcs.readBuffer(storedName).catch((err) => {
      console.error(`OG image: could not read the stored card ${storedName}:`, err.message);
      return null;
    });
    if (stored) return stored;
  }

  const buffer = await (portrait ? renderPortraitCard(sourceUrl) : renderPhotoCard(sourceUrl));

  if (storedName) {
    // Not awaited: the card is already in hand, and making the caller wait on
    // the upload would put storage latency back on the path of the very
    // request this whole mechanism exists to keep short.
    gcs.saveBuffer(storedName, buffer, 'image/jpeg')
      .catch(err => console.error(`OG image: could not store the card ${storedName}:`, err.message));
  }
  return buffer;
};

exports.cardFor = async (sourceUrl, { portrait = false } = {}) => {
  if (!sourceUrl || !isImageUrl(sourceUrl)) return exports.defaultCard();
  if (cache.has(sourceUrl)) return cache.get(sourceUrl);
  if (inFlight.has(sourceUrl)) return inFlight.get(sourceUrl);

  const job = buildCard(sourceUrl, portrait)
    .then((buffer) => {
      remember(sourceUrl, buffer);
      return buffer;
    })
    .catch((err) => {
      console.error(`OG image: falling back to the default card for ${sourceUrl}:`, err.message);
      return exports.defaultCard();
    })
    .finally(() => inFlight.delete(sourceUrl));

  inFlight.set(sourceUrl, job);
  return job;
};

// A crawler asks for the page first and the og:image a moment later, and it
// caches whatever that second request returns for weeks — so the very first
// scrape of a link is the one that decides how it looks to everyone. Kicking
// the render off while the page HTML is still being written means the image is
// usually finished, or at least well underway, by the time it's asked for.
// cardFor's in-flight map makes the real request join this job rather than
// start a second one.
//
// Deliberately capped: a burst of first-time views should never have more
// decodes running at once than the container can comfortably hold in memory.
// Anything skipped here still renders normally when it's actually requested.
const MAX_CONCURRENT_WARMUPS = 4;

exports.warm = (sourceUrl, options) => {
  if (!sourceUrl || cache.has(sourceUrl) || inFlight.has(sourceUrl)) return;
  if (inFlight.size >= MAX_CONCURRENT_WARMUPS) return;
  exports.cardFor(sourceUrl, options).catch(() => {});
};

exports.WIDTH = WIDTH;
exports.HEIGHT = HEIGHT;
