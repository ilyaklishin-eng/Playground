(() => {
  const DEFAULT_EMAIL = "ilyaklishin@gmail.com";
  const DEFAULT_SUBJECT = "Inquiry from klishin.work";
  const DEFAULT_COPY_LABEL = "Copy email";
  const DEFAULT_COPIED_LABEL = "Email copied";
  const DEFAULT_EMAIL_LABEL = "Email Ilia Klishin";
  const clean = (value = "") => String(value || "").replace(/\|/g, "").trim();

  const copyText = async (text) => {
    const value = String(text || "").trim();
    if (!value) return false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (_) {}

    try {
      const area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "absolute";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      return Boolean(ok);
    } catch (_) {
      return false;
    }
  };

  const attachCopyFallback = (node, address) => {
    if (!node || !address) return;
    const parent = node.parentElement;
    if (!parent) return;
    if (parent.querySelector(`button.js-email-copy[data-email="${address}"]`)) return;

    const copyLabel = clean(node.dataset.copyLabel) || DEFAULT_COPY_LABEL;
    const copiedLabel = clean(node.dataset.copiedLabel) || DEFAULT_COPIED_LABEL;
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "cta-btn js-email-copy";
    copyButton.dataset.email = address;
    copyButton.textContent = copyLabel;
    copyButton.setAttribute("aria-label", `Copy ${address}`);

    copyButton.addEventListener("click", async () => {
      const previous = copyButton.textContent;
      const copied = await copyText(address);
      copyButton.textContent = copied ? copiedLabel : address;
      window.setTimeout(() => {
        copyButton.textContent = previous;
      }, 1800);
    });

    node.insertAdjacentElement("afterend", copyButton);
  };

  const attachPrimaryFallback = (node, address) => {
    if (!node || !address || node.dataset.mailtoBound === "1") return;
    node.dataset.mailtoBound = "1";

    const copiedLabel = clean(node.dataset.copiedLabel) || DEFAULT_COPIED_LABEL;
    const defaultLabel = clean(node.dataset.label) || DEFAULT_EMAIL_LABEL;

    node.addEventListener("click", () => {
      window.setTimeout(async () => {
        const copied = await copyText(address);
        if (!copied) return;
        const previous = node.textContent || defaultLabel;
        node.textContent = copiedLabel;
        node.classList.add("is-copied");
        window.setTimeout(() => {
          node.classList.remove("is-copied");
          node.textContent = previous;
        }, 1600);
      }, 0);
    });
  };

  const buildEmail = (node) => {
    const user = clean(node.dataset.user);
    const domain = clean(node.dataset.domain);
    const subject = clean(node.dataset.subject) || DEFAULT_SUBJECT;
    const label = String(node.dataset.label || "Send email");
    let address = DEFAULT_EMAIL;

    if (!user || !domain) {
      if (!node.getAttribute("href") || node.getAttribute("href") === "#") {
        node.setAttribute("href", `mailto:${DEFAULT_EMAIL}?subject=${encodeURIComponent(subject)}`);
      }
      attachPrimaryFallback(node, DEFAULT_EMAIL);
      attachCopyFallback(node, DEFAULT_EMAIL);
      return;
    }

    address = `${user}@${domain}`;

    node.href = `mailto:${address}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
    node.textContent = label === "__address__" ? address : label;
    node.setAttribute("aria-label", `Email ${address}`);
    attachPrimaryFallback(node, address);
    attachCopyFallback(node, address);
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
