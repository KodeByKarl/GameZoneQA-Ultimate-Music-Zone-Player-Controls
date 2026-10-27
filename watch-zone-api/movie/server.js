const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const morgan = require("morgan");
const sodium = require("libsodium-wrappers");
const localModule = name => require(path.join(__dirname, fs.existsSync(path.join(__dirname, `${name}.js`)) ? `${name}.js` : `${name}.jsc`));
const { fetchVidSrcStreams, hlsSegmentExtension } = localModule("vidsrc");

// Setup browser globals and crypto polyfills required by script.js and fu.wasm
global.window = global;
global.globalThis = global;

if (!globalThis.crypto) {
  globalThis.crypto = crypto.webcrypto || {
    getRandomValues: (arr) => crypto.randomFillSync(arr)
  };
}

if (!globalThis.performance) {
  const { performance } = require("perf_hooks");
  globalThis.performance = performance;
}

if (!globalThis.TextEncoder) {
  const { TextEncoder, TextDecoder } = require("util");
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}

global.document = {
  cookie: "",
  domain: "vidlink.pro",
  referrer: "https://vidlink.pro/",
  location: {
    href: "https://vidlink.pro/",
    origin: "https://vidlink.pro",
    hostname: "vidlink.pro",
    pathname: "/"
  }
};
global.window.location = global.document.location;
global.navigator = {
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  platform: "Win32"
};

// Load Go WASM glue
localModule("script");

let isWasmInitialized = false;

async function initVidlinkWasm() {
  if (isWasmInitialized) return;
  try {
    await sodium.ready;
    global.sodium = sodium;

    const go = new global.Dm();
    const wasmPath = path.join(__dirname, "fu.wasm");
    if (fs.existsSync(wasmPath)) {
      const wasmBuffer = fs.readFileSync(wasmPath);
      const wasmModule = await WebAssembly.instantiate(wasmBuffer, go.importObject);
      go.run(wasmModule.instance);
      isWasmInitialized = true;
      console.log("[Vidlink] Go WASM engine ready.");
    } else {
      console.warn("[Vidlink] fu.wasm not found, Vidlink provider disabled.");
    }
  } catch (err) {
    console.error("[Vidlink WASM Init Error]:", err.message);
  }
}

const app = express();

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8001);
const BASE_URL = process.env.BASE_URL || `http://0.0.0.0:${PORT}`;
const PROXY_SECRET = process.env.PROXY_SECRET || crypto.randomBytes(32).toString("hex");
const ALLOWED_MEDIA_ORIGINS = parseCsv(process.env.ALLOWED_MEDIA_ORIGINS);
const ALLOWED_MEDIA_HOSTS = parseCsv(process.env.ALLOWED_MEDIA_HOSTS);
const DEFAULT_UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 20000);

app.disable("x-powered-by");
app.use(morgan("tiny"));
app.use((_req, res, next) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, HEAD, OPTIONS");
  res.setHeader("access-control-allow-headers", "range, content-type");
  res.setHeader("access-control-expose-headers", "content-length, content-range, content-type, accept-ranges");
  res.setHeader("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("pragma", "no-cache");
  res.setHeader("expires", "0");
  res.setHeader("surrogate-control", "no-store");
  next();
});

app.options("*", (_req, res) => {
  res.sendStatus(204);
});

function parseCsv(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isAllowedUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return false;
  }

  if (ALLOWED_MEDIA_ORIGINS.length > 0) {
    return ALLOWED_MEDIA_ORIGINS.includes(parsed.origin);
  }

  if (ALLOWED_MEDIA_HOSTS.length > 0) {
    return ALLOWED_MEDIA_HOSTS.includes(parsed.hostname);
  }

  return true;
}

function signUrl(rawUrl) {
  return crypto.createHmac("sha256", PROXY_SECRET).update(rawUrl).digest("hex");
}

function getBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  if (req) {
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
    let host = req.headers["x-forwarded-host"] || req.headers.host;
    if (host) {
      if (host.startsWith("0.0.0.0")) {
        host = host.replace("0.0.0.0", "127.0.0.1");
      }
      return `${proto}://${host}`;
    }
  }
  return BASE_URL;
}

const urlMap = new Map();
const MAX_MAP_SIZE = 20000;

function storeUrl(rawUrl, customHeaders = null) {
  const hash = crypto.createHash("md5").update(rawUrl).digest("hex").slice(0, 16);
  if (urlMap.size >= MAX_MAP_SIZE) {
    const firstKey = urlMap.keys().next().value;
    urlMap.delete(firstKey);
  }
  urlMap.set(hash, { url: rawUrl, headers: customHeaders });
  return hash;
}

function detectExtension(rawUrl) {
  try {
    const pathname = new URL(rawUrl).pathname.toLowerCase();
    if (pathname.endsWith(".mpd")) return ".mpd";
    if (pathname.endsWith(".m3u8")) return ".m3u8";
    if (pathname.endsWith(".vtt") || pathname.endsWith(".srt")) return ".vtt";
    if (pathname.endsWith(".mp4") || pathname.endsWith(".m4s")) return ".mp4";
    if (pathname.endsWith(".ts") || pathname.endsWith(".image") || pathname.endsWith(".png")) return ".ts";
  } catch {}
  return ".bin";
}

function makeProxyUrl(rawUrl, req, customHeaders = null, extraParams = "", forcedExtension = null) {
  const id = storeUrl(rawUrl, customHeaders);
  const ext = forcedExtension || detectExtension(rawUrl);
  const token = signUrl(rawUrl);
  const encoded = Buffer.from(rawUrl, "utf8").toString("base64url");
  const base = getBaseUrl(req);
  return `${base}/proxy/${id}${ext}?token=${token}&b64=${encoded}${extraParams}`;
}

function resolveProxyUrl(paramId, queryToken, queryB64) {
  const parts = paramId.split("/");
  const mainId = parts[0].replace(/\.(mpd|m3u8|vtt|mp4|ts|bin)$/i, "");
  const subPath = parts.slice(1).join("/");

  if (urlMap.has(mainId)) {
    const entry = urlMap.get(mainId);
    if (subPath) {
      const fullUrl = new URL(subPath, entry.url).toString();
      return { url: fullUrl, headers: entry.headers };
    }
    return entry;
  }
  if (queryB64) {
    const rawUrl = verifySignedUrl(queryB64, queryToken);
    return rawUrl ? { url: subPath ? new URL(subPath, rawUrl).toString() : rawUrl, headers: null } : null;
  }
  const rawUrl = verifySignedUrl(mainId, queryToken);
  return rawUrl ? { url: subPath ? new URL(subPath, rawUrl).toString() : rawUrl, headers: null } : null;
}

function verifySignedUrl(encoded, token) {
  let rawUrl;
  try {
    rawUrl = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = signUrl(rawUrl);
  const expectedBuffer = Buffer.from(expected, "hex");
  const tokenBuffer = Buffer.from(String(token || ""), "hex");

  if (expectedBuffer.length !== tokenBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(expectedBuffer, tokenBuffer)) {
    return null;
  }

  return rawUrl;
}

function pickContentType(rawUrl, upstreamContentType) {
  const pathname = new URL(rawUrl).pathname.toLowerCase();

  if (pathname.endsWith(".mpd") || (upstreamContentType && upstreamContentType.includes("dash"))) return "application/dash+xml";
  if (pathname.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (pathname.endsWith(".vtt") || pathname.endsWith(".srt")) return "text/vtt";
  if (pathname.endsWith(".mp4") || pathname.endsWith(".m4s")) return "video/mp4";

  if (pathname.endsWith(".ts") || pathname.endsWith(".image") || pathname.includes("seg") || pathname.endsWith(".png") || pathname.endsWith(".jpeg") || pathname.endsWith(".jpg")) {
    return "video/mp2t";
  }

  if (upstreamContentType && !upstreamContentType.includes("image/") && !upstreamContentType.includes("text/html")) {
    return upstreamContentType;
  }

  return "video/mp2t";
}

function isHlsUrl(rawUrl) {
  const pathname = new URL(rawUrl).pathname.toLowerCase();
  return pathname.endsWith(".m3u8");
}

function isHlsContent(rawUrl, contentType = "") {
  return isHlsUrl(rawUrl) || /mpegurl|m3u8/i.test(contentType);
}

function isDashUrl(rawUrl) {
  const pathname = new URL(rawUrl).pathname.toLowerCase();
  return pathname.endsWith(".mpd");
}

function isDashContent(rawUrl, contentType = "") {
  return isDashUrl(rawUrl) || /dash/i.test(contentType);
}

function isSubtitleUrl(rawUrl, contentType = "") {
  const pathname = new URL(rawUrl).pathname.toLowerCase();
  return pathname.endsWith(".vtt") || pathname.endsWith(".srt") || contentType.includes("vtt") || contentType.includes("srt");
}

function convertSrtToVtt(srtText) {
  if (srtText.trim().startsWith("WEBVTT")) {
    return srtText;
  }
  const vtt = "WEBVTT\n\n" + srtText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return vtt;
}

function rewriteHlsPlaylist(rawUrl, text, req, customHeaders = null) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
          const absoluteUrl = new URL(uri, rawUrl).toString();
          return `URI="${makeProxyUrl(absoluteUrl, req, customHeaders)}"`;
        });
      }

      const absoluteUrl = new URL(trimmed, rawUrl).toString();
      return makeProxyUrl(absoluteUrl, req, customHeaders, "", hlsSegmentExtension(absoluteUrl));
    })
    .join("\n");
}

function rewriteMpdManifest(rawUrl, xmlText, req, customHeaders = null) {
  const baseUrlDir = rawUrl.substring(0, rawUrl.lastIndexOf("/") + 1);
  const baseId = storeUrl(baseUrlDir, customHeaders);
  const base = getBaseUrl(req);
  const baseProxyFolderUrl = `${base}/proxy/${baseId}/`;

  let modifiedXml = xmlText;
  if (modifiedXml.includes("<BaseURL>")) {
    modifiedXml = modifiedXml.replace(/<BaseURL>.*?<\/BaseURL>/gi, `<BaseURL>${baseProxyFolderUrl}</BaseURL>`);
  } else {
    modifiedXml = modifiedXml.replace(/<MPD([^>]*)>/i, `<MPD$1>\n\t<BaseURL>${baseProxyFolderUrl}</BaseURL>`);
  }
  return modifiedXml;
}

async function fetchWithTimeout(rawUrl, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_UPSTREAM_TIMEOUT_MS);

  let referer = options.headers?.Referer || options.headers?.referer;
  if (!referer) {
    try {
      referer = `${new URL(rawUrl).origin}/`;
    } catch {
      referer = undefined;
    }
  }

  let ua = options.headers?.["user-agent"] || options.headers?.["User-Agent"];
  if (!ua || ua.includes("Python") || ua.includes("curl") || ua.includes("Wget")) {
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";
  }

  try {
    return await fetch(rawUrl, {
      ...options,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent": ua,
        ...(referer ? { referer } : {}),
        ...(options.headers || {})
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function playbackHeaders(rawUrl, customHeaders = {}, forcedReferer = null) {
  let mediaOrigin = "";
  try {
    mediaOrigin = new URL(rawUrl).origin;
  } catch {}
  const referer = forcedReferer || customHeaders.Referer || customHeaders.referer || (mediaOrigin ? `${mediaOrigin}/` : "");
  let origin = customHeaders.Origin || customHeaders.origin || mediaOrigin;
  if (forcedReferer) {
    try { origin = new URL(forcedReferer).origin; } catch {}
  }
  return {
    "User-Agent": customHeaders["User-Agent"] || customHeaders["user-agent"] || global.navigator.userAgent,
    ...(referer ? { Referer: referer } : {}),
    ...(origin ? { Origin: origin } : {}),
    ...customHeaders
  };
}

app.use(express.static(path.join(__dirname, "public")));

const FALLBACK_KEY = "RB0fpH8ZEyVLkv7c2i6MAJ5u3IKFDxlS1NTsnGaqmXYdUrtzjwObCgQP94hoeW+/=";
let cachedCipherKey = FALLBACK_KEY;

async function getLiveCipherKey() {
  if (cachedCipherKey && cachedCipherKey !== FALLBACK_KEY) return cachedCipherKey;

  try {
    const res = await fetch("https://vidnest.fun/movie/324857", {
      headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    if (res.ok) {
      const html = await res.text();
      const chunks = Array.from(new Set(html.match(/\/_next\/static\/chunks\/[a-zA-Z0-9_\-\.]+\.js/g) || []));
      const keyRegex = /\}\(t\.data\s*,\s*["']([a-zA-Z0-9\+/=]{60,70})["']\)/;

      const chunkResults = await Promise.all(
        chunks.map(async (chunk) => {
          try {
            const cRes = await fetch(`https://vidnest.fun${chunk}`, {
              headers: { "user-agent": "Mozilla/5.0" }
            });
            if (cRes.ok) {
              const content = await cRes.text();
              const match = keyRegex.exec(content);
              if (match && match[1]) {
                return match[1];
              }
            }
          } catch {}
          return null;
        })
      );

      const foundKey = chunkResults.find(Boolean);
      if (foundKey) {
        cachedCipherKey = foundKey;
        return cachedCipherKey;
      }
    }
  } catch {}

  cachedCipherKey = FALLBACK_KEY;
  return cachedCipherKey;
}

function decryptCipher(encryptedData, alphabet) {
  const posMap = new Map();
  for (let i = 0; i < alphabet.length; i++) posMap.set(alphabet[i], i);

  const res = [];
  for (let i = 0; i < encryptedData.length; i += 4) {
    let o = encryptedData.slice(i, i + 4);
    while (o.length < 4) o += "=";
    const l = [];
    for (let k = 0; k < 4; k++) {
      const val = posMap.get(o[k]);
      l.push(val !== undefined ? val : 64);
    }
    res.push((l[0] << 2) | (l[1] >> 4));
    if (l[2] !== 64) res.push(((l[1] & 15) << 4) | (l[2] >> 2));
    if (l[3] !== 64) res.push(((l[2] & 3) << 6) | l[3]);
  }
  const str = new TextDecoder().decode(new Uint8Array(res));
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

async function fetchVidlinkStreams(tmdbId, type, season, episode) {
  await initVidlinkWasm();
  if (!global.getAdv) return { streams: [], subtitles: [] };

  const token = global.getAdv(tmdbId.toString());
  const endpoint = type === "tv"
    ? `https://vidlink.pro/api/b/tv/${token}/${season}/${episode}?multiLang=0`
    : `https://vidlink.pro/api/b/movie/${token}?multiLang=0`;

  const referer = type === "tv"
    ? `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`
    : `https://vidlink.pro/movie/${tmdbId}`;

  try {
    const up = await fetchWithTimeout(endpoint, {
      headers: {
        "user-agent": global.navigator.userAgent,
        "referer": referer,
        "origin": "https://vidlink.pro",
        "X-Playback-Environment": "dash-hevc"
      }
    });

    if (!up.ok) return { streams: [], subtitles: [] };
    const data = await up.json();
    const streams = [];
    const subtitles = [];

    if (data && data.stream) {
      const streamObj = data.stream;

      // Extract MP4 quality URLs
      if (streamObj.qualities) {
        for (const [resKey, qInfo] of Object.entries(streamObj.qualities)) {
          if (qInfo && qInfo.url) {
            const qHeaders = qInfo.headers || null;
            streams.push({
              source: "vidlink",
              server: `vidlink-${resKey}p`,
              quality: resKey,
              type: qInfo.type || "mp4",
              url: qInfo.url,
              referer,
              headers: playbackHeaders(qInfo.url, {
                ...(qHeaders || {}),
                "X-Playback-Environment": "dash-hevc"
              }, referer)
            });
          }
        }
      }

      // Extract Playlist URL (DASH / HLS)
      if (streamObj.playlist) {
        const pHeaders = streamObj.playlistHeaders || (streamObj.headers ? streamObj.headers : null);
        streams.push({
          source: "vidlink",
          server: "Milo",
          type: streamObj.type || streamObj.deliveryType || "hls",
          url: streamObj.playlist,
          referer,
          headers: playbackHeaders(streamObj.playlist, {
            ...(pHeaders || {}),
            "X-Playback-Environment": "dash-hevc"
          }, referer)
        });
      }

      // Extract Captions / Subtitles with label field matching vidnest-private structure
      if (Array.isArray(streamObj.captions)) {
        for (const cap of streamObj.captions) {
          if (cap && cap.url) {
            subtitles.push({
              label: cap.language || "Unknown",
              url: cap.url,
              source: "vidlink",
              headers: playbackHeaders(cap.url, {}, referer)
            });
          }
        }
      }
    }

    return { streams, subtitles };
  } catch (err) {
    console.error("[Vidlink Provider Fetch Error]:", err.message);
    return { streams: [], subtitles: [] };
  }
}

app.get("/", (_req, res) => {
  const indexPath = path.join(__dirname, "public", "index.html");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.type("html").send("<h1>Reya Vid Extractor</h1>");
});

app.get("/api/stream", async (req, res) => {
  const { tmdbId, type = "movie", season = "1", episode = "1" } = req.query;
  if (!tmdbId) {
    return res.status(400).json({ error: "tmdbId parameter is required" });
  }

  const pathSuffix = type === "tv" ? `tv/${tmdbId}/${season}/${episode}` : `movie/${tmdbId}`;
  const cipherKey = await getLiveCipherKey();

  const providers = {
    catflix: `https://new.vidnest.fun/yflix/${pathSuffix}`,
    filxer: `https://new.vidnest.fun/rogflix/${pathSuffix}`,
    zeta: `https://new.vidnest.fun/nextgencloudfabric/${pathSuffix}`,
    alfa: `https://new.vidnest.fun/videasy/${pathSuffix}`,
    beta: `https://new.vidnest.fun/vidxyz/${pathSuffix}`
  };

  const headers = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "origin": "https://vidnest.fun",
    "referer": "https://vidnest.fun/"
  };

  const streams = [];
  const vidlinkSubtitles = [];

  const vidsrcPromise = fetchVidSrcStreams({
    tmdbId, type, season, episode, fetchWithTimeout, makeProxyUrl, req
  }).catch((error) => {
    console.error("[VidSrc Provider Fetch Error]:", error.message);
    return { streams: [], subtitles: [] };
  });

  // 1. Fetch Vidlink streams & subtitles
  try {
    const vidlinkData = await fetchVidlinkStreams(tmdbId, type, season, episode);
    if (vidlinkData.streams) streams.push(...vidlinkData.streams);
    if (vidlinkData.subtitles) vidlinkSubtitles.push(...vidlinkData.subtitles);
  } catch {}

  // 2. Fetch Vidnest streams
  const providerEntries = Object.entries(providers);
  const vidnestPromises = providerEntries.map(async ([name, endpoint]) => {
    try {
      const up = await fetchWithTimeout(endpoint, { headers });
      if (up.ok) {
        const data = await up.json();
        if (data.encrypted && data.data) {
          const dec = decryptCipher(data.data, cipherKey);
          const rawLink = dec.url || (Array.isArray(dec.all_urls) && dec.all_urls[0]);
          if (rawLink) {
            return {
              source: "vidnest",
              server: name,
              url: rawLink,
              referer: `${new URL(rawLink).origin}/`,
              headers: playbackHeaders(rawLink)
            };
          }
        }
      }
    } catch {}
    return null;
  });

  // 3. Fetch sub.vdrk.site subtitles (matching vidnest-private)
  const subEndpoint = type === "tv"
    ? `https://sub.vdrk.site/v2/tv/${tmdbId}/${season}/${episode}`
    : `https://sub.vdrk.site/v2/movie/${tmdbId}`;

  const vdrkSubPromise = (async () => {
    try {
      const subUp = await fetchWithTimeout(subEndpoint, { headers });
      if (subUp.ok) {
        const subData = await subUp.json();
        if (Array.isArray(subData)) {
          return subData.map(s => {
            const rawSub = s.file || s.url;
            return rawSub ? {
              label: s.label || s.language || "Unknown",
              url: rawSub,
              language: s.language || s.lang || "",
              source: "vidnest",
              headers: playbackHeaders(rawSub)
            } : null;
          }).filter(Boolean);
        }
      }
    } catch {}
    return [];
  })();

  const [vidnestResults, vdrkSubtitles, vidsrcData] = await Promise.all([
    Promise.all(vidnestPromises),
    vdrkSubPromise,
    vidsrcPromise
  ]);

  for (const s of vidnestResults) {
    if (s) streams.push(s);
  }
  streams.push(...vidsrcData.streams);
  const subtitles = [...vdrkSubtitles, ...vidlinkSubtitles, ...vidsrcData.subtitles];

  // Position Milo server streams at the bottom of the streams array
  const nonMiloStreams = streams.filter(s => s && s.server !== "Milo");
  const miloStreams = streams.filter(s => s && s.server === "Milo");
  const orderedStreams = [...miloStreams, ...nonMiloStreams];

  res.json({
    tmdbId,
    mediaType: type,
    season: type === "tv" ? season : undefined,
    episode: type === "tv" ? episode : undefined,
    streamCount: orderedStreams.length,
    streams: orderedStreams,
    subtitles
  });
});

app.get("/sources", (req, res) => {
  const { tmdbId, mediaType, seasonId, episodeId } = req.query;
  const targetUrl = `/api/stream?tmdbId=${tmdbId || ""}&type=${mediaType || "movie"}&season=${seasonId || "1"}&episode=${episodeId || "1"}`;
  res.redirect(307, targetUrl);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, vidlinkWasmReady: isWasmInitialized });
});

app.get("/probe", async (req, res) => {
  const rawUrl = String(req.query.url || "");
  if (!rawUrl) {
    return res.status(400).json({ error: "url is required" });
  }

  if (!isAllowedUrl(rawUrl)) {
    return res.status(403).json({ error: "URL origin is not allowlisted" });
  }

  const upstream = await fetchWithTimeout(rawUrl, { method: "HEAD" });
  if (!upstream.ok) {
    return res.status(502).json({
      error: "Upstream probe failed",
      status: upstream.status,
      statusText: upstream.statusText,
    });
  }

  const contentLength = Number(upstream.headers.get("content-length") || 0);
  const contentType = pickContentType(rawUrl, upstream.headers.get("content-type"));
  const acceptRanges = upstream.headers.get("accept-ranges") || "";

  res.json({
    url: rawUrl,
    contentType,
    contentLength,
    contentLengthMb: contentLength ? Math.round((contentLength / 1024 / 1024) * 100) / 100 : null,
    acceptRanges,
    likelyPlaceholder: contentType.includes("video/") && contentLength > 0 && contentLength < 25 * 1024 * 1024,
  });
});

app.get("/proxy/:encoded(*)", async (req, res, next) => {
  try {
    const resolved = resolveProxyUrl(req.params.encoded, req.query.token, req.query.b64);
    if (!resolved) {
      return res.status(403).json({ error: "Invalid proxy token or expired media link" });
    }

    const rawUrl = typeof resolved === "object" ? resolved.url : resolved;
    const customHeaders = typeof resolved === "object" ? resolved.headers : null;

    if (!rawUrl || !isAllowedUrl(rawUrl)) {
      return res.status(403).json({ error: "URL origin is not allowlisted" });
    }

    const range = req.headers.range;
    const userAgent = req.headers["user-agent"];

    const fetchHeaders = {
      ...(range ? { range } : {}),
      ...(userAgent ? { "user-agent": userAgent } : {}),
      ...(customHeaders || {})
    };

    const upstream = await fetchWithTimeout(rawUrl, {
      headers: fetchHeaders
    });

    if (!upstream.ok && upstream.status !== 206) {
      return res.status(502).json({
        error: "Upstream fetch failed",
        status: upstream.status,
        statusText: upstream.statusText,
      });
    }

    res.status(upstream.status);
    const contentType = pickContentType(rawUrl, upstream.headers.get("content-type"));
    res.setHeader("content-type", contentType);
    res.setHeader("accept-ranges", upstream.headers.get("accept-ranges") || "bytes");

    // Subtitle Handling: convert SRT to WebVTT & handle download query parameter (?dl=1)
    if (isSubtitleUrl(rawUrl, contentType)) {
      const isDownload = req.query.dl === "1" || req.query.download === "1";
      const filename = path.basename(new URL(rawUrl).pathname) || "subtitle.vtt";

      if (isDownload) {
        res.setHeader("content-disposition", `attachment; filename="${filename}"`);
      }

      const text = await upstream.text();
      const vttContent = convertSrtToVtt(text);
      res.setHeader("content-type", "text/vtt; charset=utf-8");
      res.setHeader("content-length", Buffer.byteLength(vttContent, "utf-8"));
      return res.send(vttContent);
    }

    // DASH Playlist Handling
    if (isDashContent(rawUrl, contentType)) {
      const accept = req.headers.accept || "";
      if (accept.includes("text/html") && !req.query.raw) {
        res.setHeader("content-type", "text/html; charset=utf-8");
        const streamUrl = `${req.originalUrl}${req.originalUrl.includes('?') ? '&' : '?'}raw=1`;
        return res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reya Vid Extractor — DASH Playback</title>
  <script src="https://cdn.dashjs.org/latest/dash.all.min.js"></script>
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    video { width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: contain; }
  </style>
</head>
<body>
  <video id="video" controls autoplay playsinline muted></video>
  <script>
    const video = document.getElementById('video');
    const player = dashjs.MediaPlayer().create();
    player.initialize(video, "${streamUrl}", true);

    player.on(dashjs.MediaPlayer.events.CAN_PLAY, () => {
      video.play().catch(() => {
        video.muted = true;
        video.play();
      });
    });

    video.play().catch(() => {
      video.muted = true;
      video.play();
    });

    document.addEventListener('click', () => {
      if (video.muted) {
        video.muted = false;
      }
    }, { once: true });
  </script>
</body>
</html>`);
      }

      const mpdText = await upstream.text();
      res.removeHeader("content-length");
      res.setHeader("content-type", "application/dash+xml");
      res.status(200);
      return res.send(rewriteMpdManifest(rawUrl, mpdText, req, customHeaders));
    }

    // HLS Playlist Handling
    if (isHlsContent(rawUrl, contentType)) {
      const accept = req.headers.accept || "";
      if (accept.includes("text/html") && !req.query.raw) {
        res.setHeader("content-type", "text/html; charset=utf-8");
        const streamUrl = `${req.originalUrl}${req.originalUrl.includes('?') ? '&' : '?'}raw=1`;
        return res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reya Vid Extractor — HLS Playback</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    video { width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: contain; }
  </style>
</head>
<body>
  <video id="video" controls autoplay playsinline muted></video>
  <script>
    const video = document.getElementById('video');
    const src = "${streamUrl}";
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {
          video.muted = true;
          video.play();
        });
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.play().catch(() => {
        video.muted = true;
        video.play();
      });
    }

    document.addEventListener('click', () => {
      if (video.muted) {
        video.muted = false;
      }
    }, { once: true });
  </script>
</body>
</html>`);
      }

      const playlist = await upstream.text();
      res.removeHeader("content-length");
      res.status(200);
      return res.send(rewriteHlsPlaylist(rawUrl, playlist, req, customHeaders));
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    let outputBuffer = buffer;

    if (buffer.length > 120 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      if (buffer[120] === 0x47 && buffer[120 + 188] === 0x47) {
        outputBuffer = buffer.subarray(120);
      }
    }

    res.setHeader("content-length", outputBuffer.length);
    for (const header of ["cache-control", "etag", "last-modified"]) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }

    return res.send(outputBuffer);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (res.headersSent) return;
  const message = error.name === "AbortError" ? "Upstream request timed out" : error.message;
  res.status(500).json({ error: message });
});

module.exports = { app, initVidlinkWasm };

if (require.main === module) {
  initVidlinkWasm().then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`Reya Vid Extractor listening on http://${HOST}:${PORT}`);
    });
  });
}
