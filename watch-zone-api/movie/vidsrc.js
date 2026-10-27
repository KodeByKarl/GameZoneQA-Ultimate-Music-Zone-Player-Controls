const VID_SRC_API = "https://data.vidsrc.sh/api.php";
const VID_SRC_REFERER = "https://cloudorchestranova.com/";

function streamEndpoint(tmdbId, type, season, episode) {
  const query = new URLSearchParams({ type, tmdb: String(tmdbId) });
  if (type === "tv") {
    query.set("season", String(season));
    query.set("episode", String(episode));
  }
  query.set("stream_urls", "");
  return `${VID_SRC_API}?${query.toString()}`;
}

function decodeStreamUrls(data, wasmBytes) {
  if (Array.isArray(data)) return data.filter(Boolean);
  if (typeof data !== "string" || !wasmBytes) return [];

  const encoded = Buffer.from(data, "base64");
  const instance = new WebAssembly.Instance(new WebAssembly.Module(wasmBytes), {});
  const { alloc, decrypt, memory } = instance.exports;
  if (typeof alloc !== "function" || typeof decrypt !== "function" || !memory) {
    throw new Error("VidSrc decryptor exports are unavailable");
  }
  const pointer = alloc(encoded.length);
  new Uint8Array(memory.buffer, pointer, encoded.length).set(encoded);
  const length = decrypt(pointer, encoded.length);
  if (!Number.isInteger(length) || length < 0 || pointer + 12 + length > memory.buffer.byteLength) {
    throw new Error("VidSrc stream data could not be decoded");
  }
  return new TextDecoder().decode(new Uint8Array(memory.buffer, pointer + 12, length))
    .split("\n").map((url) => url.trim()).filter(Boolean);
}

function tokenFromResponse(text) {
  const value = text.trim();
  if (!value.startsWith("{") && !value.startsWith('"')) return value;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "string" ? parsed : String(parsed.token || parsed.data || parsed.result || "");
  } catch {
    return value;
  }
}

function hlsSegmentExtension(rawUrl) {
  const pathname = new URL(rawUrl).pathname.toLowerCase();
  return pathname.endsWith(".html") && pathname.includes("/content/") ? ".ts" : null;
}

async function fetchVidSrcStreamsOnce({ tmdbId, type, season, episode, fetchWithTimeout, makeProxyUrl, req }) {
  const response = await fetchWithTimeout(streamEndpoint(tmdbId, type, season, episode), {
    headers: { referer: VID_SRC_REFERER, origin: "https://cloudorchestranova.com", accept: "application/json" }
  });
  if (!response.ok) return { streams: [], subtitles: [] };

  const payload = await response.json();
  if (String(payload.status_code) !== "200" || !payload.data) return { streams: [], subtitles: [] };

  let wasmBytes = null;
  if (typeof payload.data.stream_urls === "string" && payload.vs) {
    if (payload.vs.wasm_url) {
      const wasmUrl = new URL(payload.vs.wasm_url);
      if (wasmUrl.protocol !== "https:" || wasmUrl.hostname !== "data.vidsrc.sh") {
        throw new Error("VidSrc decryptor URL is not trusted");
      }
      const wasmResponse = await fetchWithTimeout(wasmUrl.toString());
      if (!wasmResponse.ok) return { streams: [], subtitles: [] };
      wasmBytes = await wasmResponse.arrayBuffer();
    } else if (payload.vs.wasm) {
      wasmBytes = Buffer.from(payload.vs.wasm, "base64");
    }
  }

  const candidates = decodeStreamUrls(payload.data.stream_urls, wasmBytes);
  const hostTokens = new Map();
  const streams = (await Promise.all(candidates.slice(0, 5).map(async (rawUrl, index) => {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "https:") return null;
      if (!hostTokens.has(parsed.origin)) {
        hostTokens.set(parsed.origin, (async () => {
          const tokenResponse = await fetchWithTimeout(`${parsed.origin}/generate.php`, {
            headers: { referer: VID_SRC_REFERER }
          });
          return tokenResponse.ok ? tokenFromResponse(await tokenResponse.text()) : "";
        })());
      }
      const token = await hostTokens.get(parsed.origin);
      if (!token) return null;
      const mediaUrl = rawUrl.includes("__TOKEN__")
        ? rawUrl.replaceAll("__TOKEN__", token)
        : `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
      const probe = await fetchWithTimeout(mediaUrl, { headers: { referer: VID_SRC_REFERER } });
      if (!probe.ok || !/mpegurl/i.test(probe.headers.get("content-type") || "")) {
        await probe.body?.cancel();
        return null;
      }
      await probe.body?.cancel();
      return {
        source: "vidsrc",
        server: `vidsrc-${index + 1}`,
        type: "hls",
        url: makeProxyUrl(mediaUrl, req, { Referer: VID_SRC_REFERER }, "", ".m3u8"),
        referer: VID_SRC_REFERER,
        headers: {}
      };
    } catch {
      return null;
    }
  }))).filter(Boolean);

  const subtitles = (Array.isArray(payload.default_subs) ? payload.default_subs : [])
    .filter((item) => item && typeof item.url === "string" && /^https:\/\//i.test(item.url))
    .map((item) => ({
      label: item.lang || item.label || item.code || "Unknown",
      language: item.code || "",
      url: makeProxyUrl(item.url, req, { Referer: VID_SRC_REFERER }, "", ".vtt"),
      source: "vidsrc",
      headers: {}
    }));

  return { streams, subtitles };
}

async function fetchVidSrcStreams(options) {
  let first;
  try {
    first = await fetchVidSrcStreamsOnce(options);
  } catch {
    first = { streams: [], subtitles: [] };
  }
  if (first.streams.length) return first;

  // VidSrc rotates media hosts between API requests. A fresh response can
  // replace a host whose playlist has disappeared while retaining subtitles.
  const second = await fetchVidSrcStreamsOnce(options);
  return {
    streams: second.streams,
    subtitles: second.subtitles.length ? second.subtitles : first.subtitles
  };
}

module.exports = { fetchVidSrcStreams, streamEndpoint, decodeStreamUrls, hlsSegmentExtension };
