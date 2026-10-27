import { addPlaybackHeadersToWatchResponse } from "./core/hls-proxy.js";
import { extractMegaPlayDetails, warmupMegaPlay } from "./extractors/megaplay.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};
const MEGAPLAY_ORIGIN = "https://megaplay.buzz";
const MEGAPLAY_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...CORS_HEADERS,
    },
  });
}

async function withPlaybackHeaders(response) {
  if (response.status !== 200) return response;

  try {
    const data = await response.clone().json();
    return json(addPlaybackHeadersToWatchResponse(data));
  } catch {
    return response;
  }
}

async function resolveMegaPlayEpisode(anilistId, episode, language) {
  const iframeUrl = new URL(`/stream/ani/${anilistId}/${episode}/${language}`, MEGAPLAY_ORIGIN);
  const headers = {
    "User-Agent": MEGAPLAY_USER_AGENT,
    "Referer": `${MEGAPLAY_ORIGIN}/`,
    "Origin": MEGAPLAY_ORIGIN,
  };
  const details = await extractMegaPlayDetails(iframeUrl.href, {
    userAgent: MEGAPLAY_USER_AGENT,
    referer: `${MEGAPLAY_ORIGIN}/`,
  });
  const subtitles = details.tracks.map((track, index) => {
    const url = typeof track?.file === "string" ? track.file : (typeof track?.url === "string" ? track.url : "");
    if (!/^https?:\/\//i.test(url)) return null;
    return {
      url,
      label: String(track.label || track.language || `Subtitle ${index + 1}`),
      language: String(track.srclang || track.lang || track.language || "und"),
      headers,
    };
  }).filter(Boolean);
  const streams = details.sources.map((source, index) => {
    const pathname = new URL(source.url).pathname.toLowerCase();
    const type = /\.mpd$/i.test(pathname) ? "dash" : (/\.m3u8?$/i.test(pathname) ? "hls" : "direct");
    const variant = String(source.variant || "").trim();
    return {
      url: source.url,
      type,
      server: details.sources.length > 1 && variant ? `MegaPlay ${variant}` : "MegaPlay",
      quality: "",
      variant,
      referer: `${MEGAPLAY_ORIGIN}/`,
      origin: MEGAPLAY_ORIGIN,
      headers,
      priority: index === 0 ? 5 : 4,
    };
  });
  return withPlaybackHeaders(json({
    anilistId,
    episode,
    language,
    iframe: iframeUrl.href,
    streams,
    subtitles,
    headers,
  }));
}

export default {
  warmup() { return warmupMegaPlay(); },
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }

    const path = new URL(request.url).pathname;

    const megaPlayMatch = path.match(/^\/watch\/megaplay\/(\d+)(?:\/(\d+))?\/(sub|dub)\/?$/);
    if (megaPlayMatch) {
      const anilistId = Number(megaPlayMatch[1]);
      const episode = Math.max(1, Number(megaPlayMatch[2]) || 1);
      try {
        return await resolveMegaPlayEpisode(anilistId, episode, megaPlayMatch[3]);
      } catch (error) {
        return json({ error: `MegaPlay episode resolution failed: ${error.message}` }, 502);
      }
    }

    if (path === "/" || path === "/health") {
      return json({
        name: "GameZone Watch Zone Anime Resolver",
        version: "1.0.0",
        source: "megaplay",
        routes: ["/watch/megaplay/:anilistId/:episode/sub|dub"],
      });
    }

    return json({ error: "Not found" }, 404);
  },
};
