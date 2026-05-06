require("dotenv").config();

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");

const { statements } = require("./db");
const { dashboardAuth } = require("./auth");
const { shortenLimiter } = require("./rateLimiter");
const { isValidHttpUrl, isOwnDomain, getOrCreateSlug } = require("./utils");

const app = express();
const port = Number(process.env.PORT || 3000);

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet());
app.use(
  morgan("combined", {
    skip: (req) => req.path === "/healthz"
  })
);
app.use(express.json({ limit: "20kb" }));
app.use("/static", express.static(path.join(__dirname, "..", "public")));

app.get("/healthz", (_req, res) => {
  res.status(200).type("text/plain").send("ok");
});

app.post("/api/shorten", dashboardAuth, shortenLimiter, (req, res) => {
  const incoming = typeof req.body?.url === "string" ? req.body.url.trim() : "";
  if (!incoming) {
    return res.status(400).json({ error: "Field `url` is required." });
  }
  if (!isValidHttpUrl(incoming)) {
    return res.status(400).json({ error: "Only http:// and https:// URLs are allowed." });
  }
  if (isOwnDomain(incoming, req.hostname)) {
    return res.status(400).json({ error: "Refusing to shorten this service domain (anti-loop)." });
  }

  try {
    const slug = getOrCreateSlug(incoming);
    const shortUrl = `${req.protocol}://${req.get("host")}/${slug}`;
    return res.status(200).json({ slug, short_url: shortUrl });
  } catch (error) {
    console.error("shorten_error", { message: error.message });
    return res.status(500).json({ error: "Could not shorten URL." });
  }
});

app.get("/api/stats/:slug", (req, res) => {
  const row = statements.findBySlug.get(req.params.slug);
  if (!row) return res.status(404).json({ error: "Slug not found." });
  return res.status(200).json({
    slug: row.slug,
    long_url: row.long_url,
    clicks: row.clicks,
    created_at: row.created_at
  });
});

app.get("/api/links", dashboardAuth, (_req, res) => {
  const rows = statements.listLinks.all();
  return res.status(200).json({ links: rows });
});

app.get("/", dashboardAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "dashboard.html"));
});

app.get("/:slug", (req, res) => {
  const row = statements.findBySlug.get(req.params.slug);
  if (!row) return res.status(404).type("text/plain").send("Not found");

  statements.bumpClick.run(row.slug);

  console.log(
    JSON.stringify({
      event: "redirect",
      timestamp: new Date().toISOString(),
      slug: row.slug,
      ip: req.ip
    })
  );

  return res.redirect(302, row.long_url);
});

app.listen(port, () => {
  console.log(`url-shortener listening on port ${port}`);
});
