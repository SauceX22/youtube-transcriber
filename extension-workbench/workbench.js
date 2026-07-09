let openWorkbenchMenu = null;
const workbenchProgressStages = [
  { at: 0, label: "Sending to transcriber..." },
  { at: 5, label: "Checking for captions..." },
  { at: 15, label: "Downloading audio..." },
  { at: 35, label: "Transcribing audio..." },
  { at: 60, label: "Processing transcript..." },
  { at: 80, label: "Almost done..." },
  { at: 90, label: "Finishing up..." },
];

document.querySelectorAll('a[href="#"]').forEach((link) => {
  link.addEventListener("click", (event) => event.preventDefault());
});

function clearWorkbenchRuntime(popup) {
  if (popup._workbenchProgressTimer) {
    clearInterval(popup._workbenchProgressTimer);
    popup._workbenchProgressTimer = null;
  }
  popup.querySelector(".workbench-runtime-state")?.remove();
  popup.querySelectorAll("[data-workbench-runtime-hidden]").forEach((node) => {
    node.hidden = false;
    node.removeAttribute("data-workbench-runtime-hidden");
  });
  popup.querySelectorAll(":scope > .state, :scope > .recent-section").forEach((node) => {
    node.hidden = false;
  });
}

function startWorkbenchProgress(popup, { writeLabels = true } = {}) {
  const bar = popup.querySelector("[data-progress-fill]");
  const label = popup.querySelector("[data-progress-label]");
  if (!bar || !label) return;

  if (popup._workbenchProgressTimer) {
    clearInterval(popup._workbenchProgressTimer);
  }

  bar.classList.remove("indeterminate");
  bar.style.transition = "none";
  bar.style.width = "0%";
  void bar.offsetWidth;
  bar.style.transition = "";

  let stageIdx = 0;
  let elapsed = 0;
  label.textContent = writeLabels
    ? workbenchProgressStages[0].label
    : "Transcription in progress...";

  popup._workbenchProgressTimer = setInterval(() => {
    elapsed += 1;
    const pct = Math.min(90, 5 + 85 * (1 - Math.exp(-elapsed / 40)));
    bar.style.width = `${pct.toFixed(1)}%`;
    while (
      stageIdx < workbenchProgressStages.length - 1 &&
      pct >= workbenchProgressStages[stageIdx + 1].at
    ) {
      stageIdx += 1;
      if (writeLabels) label.textContent = workbenchProgressStages[stageIdx].label;
    }
  }, 1000);
}

function showWorkbenchTranscribing(button) {
  const popup = button.closest(".popup");
  const state = button.closest(".state");
  if (!popup || !state) return;

  clearWorkbenchRuntime(popup);

  const title = state.querySelector(".panel-title")?.textContent.trim() || "Transcribing...";
  const runtime = document.createElement("div");
  runtime.className = "workbench-runtime-state";
  runtime.innerHTML = `
    <div class="queue-card">
      <div class="queue-card-row">
        <span class="status-dot processing"></span>
        <div class="queue-card-content">
          <div class="queue-card-title"></div>
          <div class="queue-card-status" data-progress-label>Sending to transcriber...</div>
        </div>
      </div>
      <div class="progress-track">
        <div class="progress-fill" data-progress-fill></div>
      </div>
    </div>
    <button type="button" class="btn-cancel" data-reset-runtime>Cancel</button>
  `;
  runtime.querySelector(".queue-card-title").textContent = title;
  runtime.querySelector("[data-reset-runtime]").addEventListener("click", () => {
    clearWorkbenchRuntime(popup);
  });
  button.hidden = true;
  button.setAttribute("data-workbench-runtime-hidden", "true");
  button.insertAdjacentElement("afterend", runtime);
  startWorkbenchProgress(popup, { writeLabels: true });
}

function setModeButtonState(group, activeButton) {
  const buttons = Array.from(group.querySelectorAll(".settings-mode-btn"));
  for (const button of buttons) {
    const isActive = button === activeButton;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  }

  const status = group.closest("[data-mode-toggle-demo]")?.querySelector("[data-mode-status]");
  if (status) {
    status.textContent = `${activeButton.textContent.trim()} selected`;
  }

  const frameStatus = group.closest(".workbench-frame")?.querySelector(".workbench-frame-head span");
  if (frameStatus && activeButton.dataset.mode) {
    frameStatus.textContent = activeButton.dataset.mode === "local" ? "self-hosted" : "cloud";
  }

  const settingsPanel = group.closest(".settings-panel");
  const serverSection = settingsPanel?.querySelector(".settings-server");
  if (serverSection && activeButton.dataset.mode) {
    serverSection.hidden = activeButton.dataset.mode !== "local";
  }
}

document.querySelectorAll(".settings-toggle-group").forEach((group) => {
  group.querySelectorAll(".settings-mode-btn").forEach((button) => {
    button.type = "button";
    button.setAttribute("aria-pressed", button.classList.contains("active") ? "true" : "false");
    button.addEventListener("click", () => setModeButtonState(group, button));
  });
});

function getIcon(name) {
  return globalThis.TranscriberIcons?.getIcon(name) || "";
}

const workbenchActionIcons = {
  open: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
         stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M11 3h6v6M17 3l-8 8M8 4H5a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-3"/>
    </svg>
  `,
  download: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
         stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M10 3v10m0 0l-3.5-3.5M10 13l3.5-3.5"/>
      <path d="M3 15v1a1 1 0 001 1h12a1 1 0 001-1v-1"/>
    </svg>
  `,
  copy: `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
         stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="2"/>
      <path d="M13 7V5a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2"/>
    </svg>
  `,
};

document.querySelectorAll("[data-workbench-icon]").forEach((node) => {
  node.innerHTML = workbenchActionIcons[node.dataset.workbenchIcon] || "";
});

function providerIconName(provider) {
  return provider === "chatgpt" ? "chatgpt" : "claude";
}

function providerLabel(provider) {
  return provider === "chatgpt" ? "ChatGPT" : "Claude";
}

function renderProviderPickerMenu(picker, selectedProvider) {
  const menu = picker.querySelector(".provider-picker-menu");
  if (!menu) return;
  menu.querySelectorAll(".provider-picker-option").forEach((option) => {
    const isSelected = option.dataset.provider === selectedProvider;
    option.classList.toggle("is-selected", isSelected);
  });
}

function setProviderPickerState(picker, provider) {
  picker.dataset.provider = provider;
  const icon = picker.querySelector(".provider-picker-icon");
  const name = picker.querySelector(".provider-picker-name");
  if (icon) icon.innerHTML = getIcon(providerIconName(provider));
  if (name) name.textContent = providerLabel(provider);
  renderProviderPickerMenu(picker, provider);
}

document.querySelectorAll(".provider-picker").forEach((picker) => {
  setProviderPickerState(picker, picker.dataset.provider || "claude");
  const trigger = picker.querySelector(".provider-picker-trigger");
  const menu = picker.querySelector(".provider-picker-menu");
  trigger?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeWorkbenchMenu();
    if (menu) menu.hidden = !menu.hidden;
  });
  menu?.addEventListener("click", (event) => event.stopPropagation());
  menu?.querySelectorAll(".provider-picker-option").forEach((option) => {
    option.addEventListener("click", () => {
      setProviderPickerState(picker, option.dataset.provider || "claude");
      menu.hidden = true;
    });
  });
});

document.querySelectorAll(".destinations-toggle").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const isOn = toggle.classList.toggle("is-on");
    toggle.setAttribute("aria-checked", isOn ? "true" : "false");
  });
});

document.querySelectorAll(".settings-server").forEach((serverSection) => {
  const status = serverSection.querySelector(".settings-server-status");
  const startButton = serverSection.querySelector('[data-server-action="start"]');
  const stopButton = serverSection.querySelector('[data-server-action="stop"]');

  startButton?.addEventListener("click", () => {
    if (status) status.textContent = "Server running";
    startButton.hidden = true;
    if (stopButton) stopButton.hidden = false;
  });

  stopButton?.addEventListener("click", () => {
    if (status) status.textContent = "Server stopped";
    stopButton.hidden = true;
    if (startButton) startButton.hidden = false;
  });
});

document.querySelectorAll(".state .btn-transcribe").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    showWorkbenchTranscribing(button);
  });
});

function buildSummarizeMenu({ native = false } = {}) {
  const menu = document.createElement("div");
  menu.className = "recent-summarize-menu workbench-dynamic-menu";
  const nativeItem = native
    ? `
      <button type="button" class="recent-summarize-menu-item" data-provider="transcriber">
        ${getIcon("nativeSummary")}
        <span class="recent-summarize-menu-name">Transcriber</span>
        <span class="recent-summarize-menu-hint">in panel</span>
      </button>
    `
    : "";

  menu.innerHTML = `
    <div class="recent-summarize-menu-label">Summarize with</div>
    ${nativeItem}
    <button type="button" class="recent-summarize-menu-item" data-provider="claude">
      ${getIcon("claude")}
      <span class="recent-summarize-menu-name">Claude</span>
      <span class="recent-summarize-menu-hint">last used</span>
    </button>
    <button type="button" class="recent-summarize-menu-item" data-provider="chatgpt">
      ${getIcon("chatgpt")}
      <span class="recent-summarize-menu-name">ChatGPT</span>
      <span class="recent-summarize-menu-tip"><span class="recent-summarize-menu-tip-key">⌘V</span> to paste transcript</span>
    </button>
  `;
  menu.addEventListener("click", (event) => event.stopPropagation());
  return menu;
}

function closeWorkbenchMenu() {
  openWorkbenchMenu?.owner?.classList.remove("open");
  openWorkbenchMenu?.menu?.remove();
  openWorkbenchMenu = null;
}

function positionWorkbenchMenu(button, menu) {
  const rect = button.getBoundingClientRect();
  menu.style.top = `${Math.round(rect.bottom + 6)}px`;
  menu.style.left = `${Math.round(Math.min(rect.left, window.innerWidth - menu.offsetWidth - 12))}px`;
}

document.querySelectorAll(".recent-summarize-btn").forEach((button) => {
  button.type = "button";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const owner = button.closest(".recent-summarize");
    if (openWorkbenchMenu?.owner === owner) {
      closeWorkbenchMenu();
      return;
    }

    closeWorkbenchMenu();
    const frame = button.closest("[data-state]");
    const native = !frame?.dataset.state?.includes("external");
    const menu = buildSummarizeMenu({ native });
    document.body.appendChild(menu);
    owner?.classList.add("open");
    openWorkbenchMenu = { owner, menu };
    positionWorkbenchMenu(button, menu);
  });
});

function buildRowActionsMenu() {
  const menu = document.createElement("div");
  menu.className = "row-actions-menu workbench-dynamic-menu";
  menu.innerHTML = `
    <button type="button" class="row-actions-menu-item">
      <span class="row-actions-menu-icon"><img src="../extension/icons/obsidian.svg" alt=""></span>
      <span class="row-actions-menu-name">Obsidian</span>
    </button>
    <div class="row-actions-menu-separator"></div>
    <button type="button" class="row-actions-menu-item">
      <span class="row-actions-menu-icon">${workbenchActionIcons.download}</span>
      <span class="row-actions-menu-name">Download as markdown</span>
    </button>
    <button type="button" class="row-actions-menu-item">
      <span class="row-actions-menu-icon">${workbenchActionIcons.copy}</span>
      <span class="row-actions-menu-name">Copy transcript</span>
    </button>
    <button type="button" class="row-actions-menu-item">
      <span class="row-actions-menu-icon">${workbenchActionIcons.open}</span>
      <span class="row-actions-menu-name">Open in web app</span>
    </button>
  `;
  menu.addEventListener("click", (event) => event.stopPropagation());
  return menu;
}

function positionRowActionsMenu(button, menu) {
  const rect = button.getBoundingClientRect();
  const menuWidth = menu.offsetWidth || 200;
  const margin = 8;
  let left = rect.right - menuWidth;
  if (left < margin) left = margin;
  if (left + menuWidth > window.innerWidth - margin) {
    left = window.innerWidth - menuWidth - margin;
  }
  menu.style.top = `${Math.round(rect.bottom + 6)}px`;
  menu.style.left = `${Math.round(left)}px`;
}

document.querySelectorAll(".row-actions-btn").forEach((button) => {
  button.type = "button";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const owner = button.closest(".row-actions");
    if (openWorkbenchMenu?.owner === owner) {
      closeWorkbenchMenu();
      return;
    }

    closeWorkbenchMenu();
    const menu = buildRowActionsMenu();
    document.body.appendChild(menu);
    owner?.classList.add("open");
    openWorkbenchMenu = { owner, menu };
    positionRowActionsMenu(button, menu);
  });
});

document.addEventListener("click", closeWorkbenchMenu);
document.addEventListener("click", () => {
  document.querySelectorAll(".provider-picker-menu").forEach((menu) => {
    menu.hidden = true;
  });
});
