const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const PLAYLIST_TYPE = "application/vnd.apple.mpegurl";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function buildLocalRelayUrl(baseOrigin, target, headers) {
  const proxied = new URL("/proxy/hls", baseOrigin);
  proxied.searchParams.set("url", target);
  if (headers.referer) proxied.searchParams.set("referer", headers.referer);
  if (headers.origin) proxied.searchParams.set("origin", headers.origin);
  if (headers.userAgent && headers.userAgent !== DEFAULT_UA) {
    proxied.searchParams.set("ua", headers.userAgent);
  }
  return proxied.toString();
}

function resolvePlaylistUrl(line, playlistUrl) {
  try {
    return new URL(line, playlistUrl).toString();
  } catch {
    return line;
  }
}

function rewriteAttributeUris(line, playlistUrl, baseOrigin, headers) {
  return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
    if (uri.startsWith("data:")) return `URI="${uri}"`;
    const absolute = resolvePlaylistUrl(uri, playlistUrl);
    return `URI="${buildLocalRelayUrl(baseOrigin, absolute, headers)}"`;
  });
}

function rewritePlaylist(body, playlistUrl, baseOrigin, headers) {
  return body
    .split(/\r?\n/)
    .map((rawLine) => {
      const line = rawLine.trim();
      if (!line) return rawLine;
      if (line.startsWith("#")) {
        return rewriteAttributeUris(rawLine, playlistUrl, baseOrigin, headers);
      }
      const absolute = resolvePlaylistUrl(line, playlistUrl);
      return buildLocalRelayUrl(baseOrigin, absolute, headers);
    })
    .join("\n");
}

function isPlaylist(url, contentType) {
  const path = new URL(url).pathname.toLowerCase();
  const type = (contentType || "").toLowerCase();
  return (
    path.endsWith(".m3u8") ||
    path.endsWith(".m3u") ||
    type.includes("mpegurl") ||
    type.includes("x-mpegurl")
  );
}

function originOf(value) {
  try { return new URL(value).origin; } catch { return ""; }
}

function playbackHeaders(url, headers = {}, referer = "") {
  const finalReferer =
    headers.Referer || headers.referer || referer ||
    (originOf(url) ? `${originOf(url)}/` : "");
  const finalOrigin = headers.Origin || headers.origin || originOf(finalReferer) || originOf(url);
  return {
    "User-Agent": headers["User-Agent"] || headers["user-agent"] || DEFAULT_UA,
    ...(finalReferer ? { Referer: finalReferer } : {}),
    ...(finalOrigin ? { Origin: finalOrigin } : {}),
    ...headers,
  };
}

function addHeadersToSubtitleList(subtitles, inheritedHeaders, referer) {
  if (!Array.isArray(subtitles)) return;
  for (const subtitle of subtitles) {
    const subtitleUrl = subtitle?.url || subtitle?.file;
    if (!subtitleUrl || typeof subtitleUrl !== "string") continue;
    subtitle.headers = playbackHeaders(
      subtitleUrl,
      { ...inheritedHeaders, ...(subtitle.headers || {}) },
      referer
    );
  }
}

export function addPlaybackHeadersToWatchResponse(data) {
  const streams = Array.isArray(data?.streams) ? data.streams : [];
  for (const stream of streams) {
    if (!stream?.url) continue;
    const referer = stream.referer || (stream.embedUrl ? `${originOf(stream.embedUrl)}/` : "");
    stream.headers = playbackHeaders(stream.url, stream.headers || {}, referer);
    stream.referer = stream.headers.Referer || referer;
    addHeadersToSubtitleList(stream.subtitles, stream.headers, stream.referer);
  }
  const responseHeaders = data?.headers || {};
  const defaultReferer =
    responseHeaders.Referer ||
    responseHeaders.referer ||
    streams.find((stream) => stream?.referer)?.referer ||
    "https://megaplay.buzz/";
  data.headers = playbackHeaders(streams[0]?.url || defaultReferer, responseHeaders, defaultReferer);
  addHeadersToSubtitleList(data?.subtitles, data.headers, defaultReferer);
  addHeadersToSubtitleList(data?.downloads, data.headers, defaultReferer);
  return data;
}

export async function handleHlsProxy(url) {
  const target = url.searchParams.get("url");
  if (!target) return json({ error: "Missing required ?url= parameter" }, 400);

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return json({ error: "Invalid url parameter" }, 400);
  }

  if (targetUrl.protocol !== "https:" && targetUrl.protocol !== "http:") {
    return json({ error: "Only http and https streams can be proxied" }, 400);
  }

  const referer = url.searchParams.get("referer") || `${targetUrl.origin}/`;
  const origin = url.searchParams.get("origin") || new URL(referer).origin;
  const userAgent = url.searchParams.get("ua") || DEFAULT_UA;

  const upstream = await fetch(targetUrl.toString(), {
    cache: "no-store",
    headers: {
      "User-Agent": userAgent,
      "Referer": referer,
      "Origin": origin,
      "Accept": "application/vnd.apple.mpegurl,application/x-mpegURL,*/*",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  const contentType = upstream.headers.get("Content-Type") || "";
  if (!upstream.ok) {
    const errorBody = await upstream.text().catch(() => "");
    return new Response(errorBody, {
      status: upstream.status,
      headers: {
        "Content-Type": contentType || "text/plain",
        "Cache-Control": "no-store",
        ...CORS_HEADERS,
      },
    });
  }

  if (isPlaylist(targetUrl.toString(), contentType)) {
    const body = await upstream.text();
    const rewritten = rewritePlaylist(body, targetUrl.toString(), url.origin, {
      referer,
      origin,
      userAgent,
    });
    return new Response(rewritten, {
      status: 200,
      headers: {
        "Content-Type": PLAYLIST_TYPE,
        "Cache-Control": "no-store",
        ...CORS_HEADERS,
      },
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType || "application/octet-stream",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    },
  });
}
