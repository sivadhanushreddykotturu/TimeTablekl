/**
 * GET /api/pinimg?src=<https://i.pinimg.com/...>
 *
 * Serves one Pinterest CDN image from our own origin so the profile-picture
 * cropper can draw it on a canvas (the CDN itself sends no CORS headers).
 * Locked to i.pinimg.com and capped in size, so it is not an open proxy.
 */

/* global Buffer */
const MAX_BYTES = 6 * 1024 * 1024;

export default async function handler(req, res) {
  try {
    const src = new URL(String(req.query?.src || ""));
    if (src.protocol !== "https:" || src.hostname !== "i.pinimg.com") {
      return res.status(400).send("Only i.pinimg.com images are allowed.");
    }

    const upstream = await fetch(src.toString(), {
      redirect: "error",
      headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*" },
    });
    const type = upstream.headers.get("content-type") || "";
    if (!upstream.ok || !type.startsWith("image/")) {
      return res.status(404).send("Image not available.");
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (bytes.length > MAX_BYTES) return res.status(413).send("Image too large.");

    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "public, s-maxage=604800, max-age=86400, immutable");
    return res.status(200).send(bytes);
  } catch {
    return res.status(400).send("Bad image link.");
  }
}
