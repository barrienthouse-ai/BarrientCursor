import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { attachDiscount, compareDealers } from "./compare.js";
import { scrapeDealer } from "./scrape.js";

const root = new URL("..", import.meta.url).pathname;
const publicDir = join(root, "public");
const jobs = new Map();
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

function send(response, status, body, contentType = "application/json; charset=utf-8") {
  response.writeHead(status, { "content-type": contentType, "cache-control": "no-store" });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}"));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function normalizeSite(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

async function runJob(job) {
  const dealers = [];
  const vehicles = [];
  const sites = [job.home, ...job.competitors];
  for (const site of sites) {
    const id = new URL(site).hostname.replace(/^www\./, "");
    job.progress.push(`Starting ${site}`);
    try {
      const scraped = await scrapeDealer(site, (message) => {
        job.progress.push(message);
      });
      const dealer = { id, name: scraped.name, website: site, inventoryUrl: scraped.inventoryUrl, count: scraped.vehicles.length };
      dealers.push(dealer);
      for (const vehicle of scraped.vehicles) {
        vehicles.push(attachDiscount({ ...vehicle, dealerId: id, dealerName: scraped.name }));
      }
    } catch (error) {
      job.errors.push({ website: site, message: error.message });
      job.progress.push(`${site}: ${error.message}`);
    }
  }
  const homeDealer = dealers.find((dealer) => dealer.id === new URL(job.home).hostname.replace(/^www\./, ""));
  job.rows = homeDealer ? compareDealers({ home: homeDealer, dealers, vehicles }) : [];
  job.dealers = dealers;
  job.pulledAt = new Date().toISOString();
  job.status = "done";
  job.progress.push("Comparison ready");
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  try {
    if (request.method === "POST" && url.pathname === "/api/compare") {
      const body = await readBody(request);
      const home = normalizeSite(body.home);
      const competitors = [...new Set((body.competitors || []).map(normalizeSite).filter(Boolean))].slice(0, 3);
      if (!home) return send(response, 400, JSON.stringify({ error: "Enter your dealership website." }));
      if (!competitors.length) return send(response, 400, JSON.stringify({ error: "Add at least one competitor website." }));
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const job = { id, status: "running", home, competitors, progress: [], errors: [], rows: [], dealers: [], pulledAt: null };
      jobs.set(id, job);
      runJob(job).catch((error) => {
        job.status = "error";
        job.progress.push(error.message);
      });
      return send(response, 202, JSON.stringify({ id }));
    }
    if (request.method === "GET" && url.pathname === "/api/jobs/latest") {
      const latest = [...jobs.values()].at(-1);
      if (!latest) return send(response, 404, JSON.stringify({ error: "No comparison yet." }));
      return send(response, 200, JSON.stringify(latest));
    }
    if (request.method === "GET" && url.pathname.startsWith("/api/jobs/")) {
      const job = jobs.get(url.pathname.split("/").pop());
      if (!job) return send(response, 404, JSON.stringify({ error: "That comparison is no longer available." }));
      return send(response, 200, JSON.stringify(job));
    }
    const filePath = join(publicDir, url.pathname === "/" ? "index.html" : url.pathname);
    const file = await readFile(filePath);
    return send(response, 200, file, types[extname(filePath)] || "application/octet-stream");
  } catch (error) {
    if (error.code === "ENOENT") return send(response, 404, "Not found", "text/plain; charset=utf-8");
    return send(response, 500, JSON.stringify({ error: error.message }));
  }
});

const port = Number(process.env.PORT || 8787);
server.listen(port, "0.0.0.0", () => {
  console.log(`inventory pricing listening on ${port}`);
});
