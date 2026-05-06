const crypto = require("crypto");
const { statements } = require("./db");

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function toBase62(buffer, length = 6) {
  let num = BigInt("0x" + buffer.toString("hex"));
  let out = "";
  for (let i = 0; i < length; i += 1) {
    const mod = Number(num % 62n);
    out = BASE62[mod] + out;
    num = num / 62n;
  }
  return out;
}

function generateSlug(length = 6) {
  const bytes = crypto.randomBytes(8);
  return toBase62(bytes, length);
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function isOwnDomain(urlValue, reqHostname) {
  const configured = (process.env.APP_DOMAIN || "").trim().toLowerCase();
  const host = (reqHostname || "").trim().toLowerCase();
  const candidates = new Set([configured, host].filter(Boolean));
  if (candidates.size === 0) return false;

  const parsed = new URL(urlValue);
  const inputHost = parsed.hostname.toLowerCase();
  return Array.from(candidates).includes(inputHost);
}

function getOrCreateSlug(longUrl) {
  const existing = statements.findByLongUrl.get(longUrl);
  if (existing) return existing.slug;

  let slug = "";
  for (let i = 0; i < 12; i += 1) {
    slug = generateSlug(6);
    try {
      statements.insertLink.run(slug, longUrl);
      return slug;
    } catch (error) {
      if (!String(error.message).includes("UNIQUE constraint failed: links.slug")) {
        if (String(error.message).includes("UNIQUE constraint failed: links.long_url")) {
          const row = statements.findByLongUrl.get(longUrl);
          if (row) return row.slug;
        }
        throw error;
      }
    }
  }

  throw new Error("Could not generate a unique 6-char slug after multiple attempts");
}

module.exports = {
  isValidHttpUrl,
  isOwnDomain,
  getOrCreateSlug
};
