const alertsButton = document.querySelector("#alerts-button");
const alertsPanel = document.querySelector("#alerts-panel");
const alertsBadge = document.querySelector("#alerts-badge");
const markReadButton = document.querySelector("#mark-read");
const visitButton = document.querySelector("#visit-button");
const contactButton = document.querySelector("#contact-button");
const pageStatus = document.querySelector("#page-status");

let unread = 3;

function setUnread(count) {
  unread = count;
  if (unread > 0) {
    alertsBadge.hidden = false;
    alertsBadge.textContent = String(unread);
    alertsButton.setAttribute("aria-label", `Alerts, ${unread} unread`);
    return;
  }
  alertsBadge.hidden = true;
  alertsButton.setAttribute("aria-label", "Alerts, no unread");
}

function setAlertsOpen(open) {
  alertsButton.setAttribute("aria-expanded", String(open));
  alertsPanel.hidden = !open;
}

alertsButton.addEventListener("click", () => {
  const open = alertsButton.getAttribute("aria-expanded") === "true";
  setAlertsOpen(!open);
});

markReadButton.addEventListener("click", () => {
  setUnread(0);
  pageStatus.textContent = "Alerts marked as read.";
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && alertsButton.getAttribute("aria-expanded") === "true") {
    setAlertsOpen(false);
    alertsButton.focus();
  }
});

visitButton.addEventListener("click", () => {
  visitButton.disabled = true;
  visitButton.textContent = "Visit requested";
  pageStatus.textContent = "Visit request saved on this page.";
});

contactButton.addEventListener("click", () => {
  const pressed = contactButton.getAttribute("aria-pressed") === "true";
  contactButton.setAttribute("aria-pressed", String(!pressed));
  contactButton.textContent = pressed ? "Contact" : "Desk notified";
  pageStatus.textContent = pressed ? "" : "The desk was notified from this page.";
});
