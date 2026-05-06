const form = document.getElementById("shorten-form");
const input = document.getElementById("url-input");
const message = document.getElementById("form-message");
const linksBody = document.getElementById("links-body");
const submitBtn = document.getElementById("submit-btn");
const searchInput = document.getElementById("search-input");
const refreshBtn = document.getElementById("refresh-btn");
const emptyState = document.getElementById("empty-state");
const toast = document.getElementById("toast");
const kpiTotalLinks = document.getElementById("kpi-total-links");
const kpiTotalClicks = document.getElementById("kpi-total-clicks");
const kpiTopSlug = document.getElementById("kpi-top-slug");
const kpiLastCreated = document.getElementById("kpi-last-created");
const tabDashboard = document.getElementById("tab-dashboard");
const tabAbout = document.getElementById("tab-about");
const dashboardView = document.getElementById("dashboard-view");
const aboutView = document.getElementById("about-view");

let allLinks = [];

function switchTab(target) {
  const showDashboard = target === "dashboard";
  dashboardView.hidden = !showDashboard;
  aboutView.hidden = showDashboard;
  tabDashboard.classList.toggle("active", showDashboard);
  tabAbout.classList.toggle("active", !showDashboard);
}

function renderMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? "#fca5a5" : "#93c5fd";
}

function showToast(text) {
  toast.textContent = text;
  toast.classList.add("show");
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function safeJson(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return {};
  }
  return response.json();
}

function updateKpis(links) {
  const totalLinks = links.length;
  const totalClicks = links.reduce((sum, item) => sum + Number(item.clicks || 0), 0);
  const top = [...links].sort((a, b) => b.clicks - a.clicks)[0];
  const latest = links[0];

  kpiTotalLinks.textContent = String(totalLinks);
  kpiTotalClicks.textContent = String(totalClicks);
  kpiTopSlug.textContent = top ? `${top.slug} (${top.clicks})` : "-";
  kpiLastCreated.textContent = latest ? new Date(`${latest.created_at}Z`).toLocaleDateString() : "-";
}

function renderLinks(links) {
  linksBody.innerHTML = "";

  links.forEach((link) => {
    const shortUrl = `${window.location.origin}/${link.slug}`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono"><a href="/${escapeHtml(link.slug)}" target="_blank" rel="noreferrer">${escapeHtml(link.slug)}</a></td>
      <td class="url-cell"><a href="${escapeHtml(link.long_url)}" target="_blank" rel="noreferrer">${escapeHtml(link.long_url)}</a></td>
      <td>${link.clicks}</td>
      <td>${new Date(link.created_at + "Z").toLocaleString()}</td>
      <td><button class="action-btn" type="button" data-copy="${escapeHtml(shortUrl)}">Copy</button></td>
    `;
    linksBody.appendChild(tr);
  });

  emptyState.style.display = links.length ? "none" : "block";
}

function filterAndRender() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    renderLinks(allLinks);
    return;
  }
  const filtered = allLinks.filter((item) => {
    return item.slug.toLowerCase().includes(query) || item.long_url.toLowerCase().includes(query);
  });
  renderLinks(filtered);
}

async function fetchLinks() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refreshing...";
  const res = await fetch("/api/links", { credentials: "same-origin" });
  const data = await safeJson(res);
  refreshBtn.disabled = false;
  refreshBtn.textContent = "Refresh";

  if (!res.ok) {
    throw new Error(data.error || "Failed to load links. Re-authenticate and try again.");
  }

  allLinks = Array.isArray(data.links) ? data.links : [];
  updateKpis(allLinks);
  filterAndRender();
}

linksBody.addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-copy]");
  if (!btn) return;
  try {
    await navigator.clipboard.writeText(btn.dataset.copy);
    showToast("Short link copied");
  } catch (_error) {
    showToast("Copy failed on this browser");
  }
});

searchInput.addEventListener("input", filterAndRender);
tabDashboard.addEventListener("click", () => switchTab("dashboard"));
tabAbout.addEventListener("click", () => switchTab("about"));
refreshBtn.addEventListener("click", () => {
  fetchLinks().catch((error) => {
    renderMessage(error.message || "Could not refresh links.", true);
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  renderMessage("");
  submitBtn.disabled = true;
  submitBtn.textContent = "Shortening...";

  const rawUrl = input.value.trim();
  if (!rawUrl) {
    renderMessage("Please enter a URL.", true);
    submitBtn.disabled = false;
    submitBtn.textContent = "Shorten";
    return;
  }

  try {
    const res = await fetch("/api/shorten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: rawUrl }),
      credentials: "same-origin"
    });

    const data = await safeJson(res);
    if (!res.ok) {
      throw new Error(data.error || "Failed to shorten URL. Re-authenticate and try again.");
    }

    message.innerHTML = `Created: <a href="${data.short_url}" target="_blank" rel="noreferrer">${data.short_url}</a>`;
    message.style.color = "#93c5fd";
    showToast("New short URL created");
    input.value = "";
    await fetchLinks();
  } catch (error) {
    renderMessage(error.message || "Unexpected error.", true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Shorten";
  }
});

fetchLinks().catch((error) => {
  renderMessage(error.message || "Could not load links.", true);
});
