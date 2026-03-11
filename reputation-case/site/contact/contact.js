(() => {
  const clean = (value = "") => String(value || "").replaceAll("|", "").trim();

  const buildEmail = (node) => {
    const user = clean(node.dataset.user);
    const domain = clean(node.dataset.domain);
    if (!user || !domain) return;

    const address = `${user}@${domain}`;
    const subject = clean(node.dataset.subject);
    const label = String(node.dataset.label || "Send email");

    node.href = `mailto:${address}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
    node.textContent = label === "__address__" ? address : label;
    node.setAttribute("aria-label", `Email ${address}`);
  };

  const exposeAddressText = (node) => {
    const user = clean(node.dataset.user);
    const domain = clean(node.dataset.domain);
    if (!user || !domain) return;
    node.textContent = `${user}@${domain}`;
  };

  const init = () => {
    document.querySelectorAll("a.js-email").forEach(buildEmail);
    document.querySelectorAll(".js-email-text").forEach(exposeAddressText);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
    return;
  }
  init();
})();
