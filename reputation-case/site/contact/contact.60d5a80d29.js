(() => {
  const enhanceEmail = (link) => {
    const address = link.href.replace(/^mailto:/, "").split("?")[0];
    if (!address || !link.href.startsWith("mailto:")) return;
    if (link.dataset.label === "__address__") link.textContent = address;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cta-btn js-email-copy";
    button.textContent = link.dataset.copyLabel || "Copy email";
    const status = document.createElement("span");
    status.setAttribute("role", "status");
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(address);
        status.textContent = link.dataset.copiedLabel || "Email copied";
      } catch {
        status.textContent = `Select and copy: ${address}`;
      }
    });
    link.after(button, status);
  };
  const init = () => document.querySelectorAll("a.js-email").forEach(enhanceEmail);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
