const competitorList = document.querySelector("#competitor-list");
const addButton = document.querySelector("#add-competitor");
const form = document.querySelector("#setup");
const statusBox = document.querySelector("#status");
const errorsBox = document.querySelector("#errors");
const report = document.querySelector("#report");
const head = document.querySelector("#head");
const body = document.querySelector("#body");
const pulled = document.querySelector("#pulled");
const homeInput = document.querySelector("#home");

const stored = JSON.parse(localStorage.getItem("pricing-sites") || "{}");
if (stored.home) homeInput.value = stored.home;

function addCompetitor(value = "") {
  if (competitorList.children.length >= 3) return;
  const row = document.createElement("div");
  row.className = "competitor-row";
  const input = document.createElement("input");
  input.type = "url";
  input.placeholder = "https://competitor.com";
  input.value = value;
  input.required = competitorList.children.length === 0;
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "secondary";
  remove.textContent = "Remove";
  remove.addEventListener("click", () => {
    row.remove();
    addButton.hidden = competitorList.children.length >= 3;
  });
  row.append(input, remove);
  competitorList.append(row);
  addButton.hidden = competitorList.children.length >= 3;
}

(stored.competitors?.length ? stored.competitors : ["", ""]).slice(0, 3).forEach(addCompetitor);
addButton.addEventListener("click", () => addCompetitor());

function money(value) {
  if (value == null) return "—";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function signed(value) {
  if (value == null) return "—";
  const formatted = money(Math.abs(value));
  return value > 0 ? `+${formatted}` : value < 0 ? `−${formatted}` : formatted;
}

function render(job) {
  const competitors = job.dealers.filter((dealer) => dealer.id !== new URL(job.home).hostname.replace(/^www\./, ""));
  head.innerHTML = `<tr>
    <th>Vehicle</th>
    <th>Your discount</th>
    ${competitors.map((dealer) => `<th>${dealer.name}<br>discount / gap</th>`).join("")}
  </tr>`;
  body.innerHTML = "";
  for (const row of job.rows) {
    const summary = document.createElement("tr");
    summary.className = "summary";
    summary.innerHTML = `
      <td class="vehicle"><span class="caret">▸</span> ${row.label}<div>${row.home.count} on your lot</div></td>
      <td>${money(row.home.avgDiscount)}<div>${row.home.avgPercent == null ? "" : row.home.avgPercent + "%"}</div></td>
      ${row.competitors.filter((dealer) => competitors.some((item) => item.id === dealer.id)).map((dealer) => `
        <td>${dealer.count ? `${money(dealer.avgDiscount)}<div class="${dealer.gap > 0 ? "gap-pos" : "gap-neg"}">${signed(dealer.gap)} gap</div>` : "—"}</td>
      `).join("")}
    `;
    const detail = document.createElement("tr");
    detail.hidden = true;
    const cell = document.createElement("td");
    cell.colSpan = 2 + competitors.length;
    cell.className = "detail";
    const dealers = [{ ...row.home, name: row.home.name }, ...row.competitors.filter((dealer) => dealer.count)];
    cell.innerHTML = dealers.map((dealer) => `
      <h3>${dealer.name}</h3>
      <table class="vins">
        <thead><tr><th>Stock</th><th>VIN</th><th>Dealer discount</th><th>%</th><th>MSRP</th></tr></thead>
        <tbody>
          ${dealer.units.map((unit) => `<tr>
            <td>${unit.stock || ""}</td>
            <td>${unit.vin}</td>
            <td>${money(unit.dealerDiscount)}</td>
            <td>${unit.discountPercent == null ? "" : unit.discountPercent + "%"}</td>
            <td>${money(unit.msrp)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    `).join("");
    detail.append(cell);
    summary.addEventListener("click", () => {
      detail.hidden = !detail.hidden;
      summary.querySelector(".caret").textContent = detail.hidden ? "▸" : "▾";
    });
    body.append(summary, detail);
  }
  report.hidden = job.rows.length === 0;
  pulled.textContent = job.pulledAt ? `Pulled ${new Date(job.pulledAt).toLocaleString()}` : "";
}

async function loadLatest() {
  const jobResponse = await fetch("/api/jobs/latest");
  if (!jobResponse.ok) return;
  const job = await jobResponse.json();
  if (job.status !== "done") return;
  render(job);
  statusBox.hidden = false;
  statusBox.textContent = job.rows.length ? `${job.rows.length} matching trims.` : "No matching trims in the last comparison.";
}

loadLatest();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const home = homeInput.value.trim();
  const competitors = [...competitorList.querySelectorAll("input")].map((input) => input.value.trim()).filter(Boolean);
  localStorage.setItem("pricing-sites", JSON.stringify({ home, competitors }));
  report.hidden = true;
  errorsBox.hidden = true;
  statusBox.hidden = false;
  statusBox.textContent = "Starting the comparison…";
  const response = await fetch("/api/compare", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ home, competitors }),
  });
  const payload = await response.json();
  if (!response.ok) {
    statusBox.textContent = payload.error;
    return;
  }
  const timer = setInterval(async () => {
    const jobResponse = await fetch(`/api/jobs/${payload.id}`);
    const job = await jobResponse.json();
    statusBox.textContent = job.progress.at(-1) || "Working…";
    if (job.status === "running") return;
    clearInterval(timer);
    if (job.errors?.length) {
      errorsBox.hidden = false;
      errorsBox.innerHTML = `<ul>${job.errors.map((error) => `<li>${error.website}: ${error.message}</li>`).join("")}</ul>`;
    }
    render(job);
    if (!job.rows.length) statusBox.textContent = "No matching new vehicles with a dealer discount line were found.";
    else statusBox.textContent = `${job.rows.length} matching trims.`;
  }, 1500);
});
