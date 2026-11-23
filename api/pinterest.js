/**
 * GET /api/pinterest?url=<pin or profile link>
 *
 * Resolves a Pinterest pin (pin.it/… or pinterest.com/pin/…) or profile
 * (pinterest.com/<user>) link to a direct i.pinimg.com image URL, for use as a
 * profile picture. Runs as a Vercel serverless function next to the app, so the
 * browser never has to talk to Pinterest (which sends no CORS headers).
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Only these hosts are ever fetched, so the endpoint can't be used as an open proxy.
const isPinterestHost = (host) =>
  host === "pin.it" || host === "pinterest.com" || /^([a-z0-9-]+\.)*pinterest\.[a-z.]+$/.test(host);

const isPinimg = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname === "i.pinimg.com";
  } catch {
    return false;
  }
};

const decode = (s) =>
  (s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\\u002F/g, "/")
    .replace(/\\\//g, "/");

function pick(html, patterns) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decode(m[1]);
  }
  return null;
}

/** Fetches a Pinterest page, following redirects only between Pinterest hosts. */
async function fetchPage(startUrl) {
  let current = startUrl;
  for (let hop = 0; hop < 5; hop++) {
    const parsed = new URL(current);
    if (parsed.protocol !== "https:" || !isPinterestHost(parsed.hostname)) {
      throw new Error("That does not look like a Pinterest link.");
    }
    const res = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": UA, "Accept": "text/html,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location"), current).toString();
      continue;
    }
    if (!res.ok) throw new Error(`Pinterest answered with HTTP ${res.status}.`);
    return { html: await res.text(), finalUrl: current };
  }
  throw new Error("Too many redirects.");
}

const sized = (url, size) => url.replace(/\/(?:originals|\d+x\d*)\//, `/${size}/`);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=86400, max-age=3600");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const send = (status, body) => res.status(status).send(JSON.stringify(body));

  try {
    let input = String(req.query?.url || "").trim();
    if (!input) return send(400, { success: false, error: "Paste a Pinterest link." });
    if (input.length > 300) return send(400, { success: false, error: "That link is too long." });
    if (!/^https?:\/\//i.test(input)) input = "https://" + input;

    let start;
    try {
      start = new URL(input);
    } catch {
      return send(400, { success: false, error: "That is not a valid link." });
    }
    start.protocol = "https:";
    if (!isPinterestHost(start.hostname)) {
      return send(400, { success: false, error: "That does not look like a Pinterest link." });
    }

    const { html, finalUrl } = await fetchPage(start.toString());
    const isPin = /\/pin\/\d+/.test(finalUrl);

    let image;
    if (isPin) {
      image =
        pick(html, [/"images_orig"\s*:\s*\{[^}]*?"url"\s*:\s*"([^"]+)"/i]) ||
        pick(html, [
          /<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/i,
          /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i,
          /"imageLargeUrl"\s*:\s*"([^"]+)"/i,
        ]);
    } else {
      // profile page: its picture is the og:image / "image_xlarge_url"
      image = pick(html, [
        /"image_xlarge_url"\s*:\s*"([^"]+)"/i,
        /"image_large_url"\s*:\s*"([^"]+)"/i,
        /<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i,
      ]);
    }

    if (!image || !isPinimg(image)) {
      return send(404, {
        success: false,
        error: "Couldn't find a picture there. The pin or profile may be private or removed.",
      });
    }

    return send(200, {
      success: true,
      kind: isPin ? "pin" : "profile",
      image: sized(image, "736x"),
      thumbnail: sized(image, "236x"),
      original: isPin ? sized(image, "originals") : image,
    });
  } catch (err) {
    return send(502, { success: false, error: err.message || "Could not read that Pinterest link." });
  }
}
