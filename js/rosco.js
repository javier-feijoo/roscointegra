function statusClass(status) {
  if (status === "correct") return "correct";
  if (status === "wrong") return "wrong";
  if (status === "pending") return "pending";
  return "disabled";
}

export function renderRoscoCircle(container, letters, activeIndex) {
  if (!container) {
    return;
  }

  const items = Array.isArray(letters) ? letters : [];
  const n = items.length;
  container.innerHTML = "";

  if (n === 0) {
    return;
  }

  const shell = container.parentElement;
  const shellRect = shell?.getBoundingClientRect?.();
  const availableW = Math.floor(shellRect?.width || 0);
  const availableH = Math.floor(shellRect?.height || 0);

  if (availableW < 140 || availableH < 140) {
    container.style.width = "";
    container.style.height = "";
    return;
  }

  const safeScale = 0.9;
  const side = Math.max(220, Math.floor(Math.min(availableW, availableH) * safeScale));
  const cx = side / 2;
  const cy = side / 2;

  const nodeSize = Math.max(34, Math.min(84, Math.floor(side * 0.09)));
  const safeMargin = Math.max(10, Math.floor(nodeSize * 0.2));
  const radius = Math.max(40, (side / 2) - (nodeSize / 2) - safeMargin);

  container.style.width = `${side}px`;
  container.style.height = `${side}px`;

  for (let i = 0; i < n; i += 1) {
    const entry = items[i];
    const angle = (2 * Math.PI * i / n) - (Math.PI / 2);
    const x = cx + (radius * Math.cos(angle));
    const y = cy + (radius * Math.sin(angle));

    const button = document.createElement("button");
    button.type = "button";
    button.className = `rosco-letter ${statusClass(entry?.status)}`;
    button.style.width = `${nodeSize}px`;
    button.style.height = `${nodeSize}px`;
    button.style.left = `${x}px`;
    button.style.top = `${y}px`;
    button.textContent = entry?.letra || "?";
    button.setAttribute("aria-label", `Letra ${entry?.letra || ""}`);
    button.setAttribute("data-index", String(i));

    if (i === activeIndex && entry?.status === "pending") {
      button.classList.add("active");
    }

    if (entry?.status === "disabled") {
      button.disabled = true;
    }

    container.appendChild(button);
  }
}
