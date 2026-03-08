const STORAGE_KEY = "ytLiveEqSettings";

const DEFAULT_SETTINGS = {
  enabled: true,
  preampDb: 0,
  bands: {
    b60: 0,
    b170: 0,
    b350: 0,
    b1k: 0,
    b35k: 0
  }
};

const BANDS = [
  { id: "preampDb", label: "Preamp", min: -12, max: 12, step: 0.5, unit: "dB" },
  { id: "b60", label: "60Hz", min: -12, max: 12, step: 0.5, unit: "dB" },
  { id: "b170", label: "170Hz", min: -12, max: 12, step: 0.5, unit: "dB" },
  { id: "b350", label: "350Hz", min: -12, max: 12, step: 0.5, unit: "dB" },
  { id: "b1k", label: "1kHz", min: -12, max: 12, step: 0.5, unit: "dB" },
  { id: "b35k", label: "3.5kHz", min: -12, max: 12, step: 0.5, unit: "dB" }
];

const BAND_IDS = BANDS.filter((band) => band.id !== "preampDb").map((band) => band.id);

function createFlatBands() {
  return BAND_IDS.reduce((acc, id) => {
    acc[id] = 0;
    return acc;
  }, {});
}

const PRESETS = {
  flat: {
    preampDb: 0,
    bands: createFlatBands()
  },
  bassBoost: {
    preampDb: -2,
    bands: { b60: 7, b170: 4, b350: 1, b1k: -1, b35k: -2 }
  },
  hyperBass: {
    preampDb: -4,
    bands: { b60: 10, b170: 6, b350: 2, b1k: -2, b35k: -3 }
  },
  vocal: {
    preampDb: -1,
    bands: { b60: -2, b170: -1, b350: 1, b1k: 4, b35k: 3 }
  },
  smile: {
    preampDb: -2,
    bands: { b60: 4, b170: 2, b350: 0, b1k: -1, b35k: 3 }
  },
  sparkle: {
    preampDb: -1,
    bands: { b60: -3, b170: -1, b350: 1, b1k: 3, b35k: 5 }
  },
  electronic: {
    preampDb: -2,
    bands: { b60: 5, b170: 1, b350: 0, b1k: 2, b35k: 4 }
  },
  classical: {
    preampDb: -1,
    bands: { b60: 0, b170: 0, b350: 0, b1k: 2, b35k: 3 }
  }
};

let settings = cloneSettings(DEFAULT_SETTINGS);
let activeTabId = null;
let saveQueue = Promise.resolve();

function cloneSettings(input) {
  const nextBands = createFlatBands();
  BAND_IDS.forEach((id) => {
    nextBands[id] = Number(input?.bands?.[id] ?? 0);
  });

  return {
    enabled: Boolean(input?.enabled ?? true),
    preampDb: Number(input?.preampDb ?? 0),
    bands: nextBands
  };
}

function setStatus(text, isError = false) {
  const status = document.getElementById("status");
  status.textContent = text;
  status.classList.toggle("error", Boolean(isError));
}

function isSupportedUrl(url) {
  if (!url) {
    return false;
  }
  return (
    url.startsWith("https://www.youtube.com/") ||
    url.startsWith("http://www.youtube.com/") ||
    url.startsWith("https://music.youtube.com/") ||
    url.startsWith("http://music.youtube.com/")
  );
}

async function getActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

function formatValue(value) {
  const n = Number(value);
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)} dB`;
}

function getSettingValue(id) {
  if (id === "preampDb") {
    return settings.preampDb;
  }
  return settings.bands[id] ?? 0;
}

function setSettingValue(id, value) {
  if (id === "preampDb") {
    settings.preampDb = value;
    return;
  }
  settings.bands[id] = value;
}

function renderSliders() {
  const root = document.getElementById("sliders");
  root.innerHTML = "";

  for (const band of BANDS) {
    const row = document.createElement("div");
    row.className = "row";

    const label = document.createElement("label");
    label.setAttribute("for", `slider-${band.id}`);
    label.textContent = band.label;

    const slider = document.createElement("input");
    slider.type = "range";
    slider.id = `slider-${band.id}`;
    slider.min = String(band.min);
    slider.max = String(band.max);
    slider.step = String(band.step);
    slider.value = String(getSettingValue(band.id));

    const valueText = document.createElement("span");
    valueText.className = "value";
    valueText.id = `value-${band.id}`;
    valueText.textContent = formatValue(getSettingValue(band.id));

    slider.addEventListener("input", async () => {
      const value = Number(slider.value);
      setSettingValue(band.id, value);
      valueText.textContent = formatValue(value);
      await persistAndApply();
    });

    row.append(label, slider, valueText);
    root.append(row);
  }
}

async function loadSettings() {
  try {
    const data = await browser.storage.local.get(STORAGE_KEY);
    settings = cloneSettings(data?.[STORAGE_KEY] || DEFAULT_SETTINGS);
  } catch (_) {
    settings = cloneSettings(DEFAULT_SETTINGS);
  }
}

async function saveSettings(nextSettings) {
  saveQueue = saveQueue
    .then(() => browser.storage.local.set({ [STORAGE_KEY]: nextSettings }))
    .catch(() => {
      // Keep queue alive even after transient storage failures.
    });
  await saveQueue;
}

async function applyToContent(nextSettings) {
  if (!activeTabId) {
    return;
  }
  try {
    await browser.tabs.sendMessage(activeTabId, {
      type: "EQ_SET_SETTINGS",
      payload: nextSettings
    });
  } catch (_) {
    // Content script may not be ready on unsupported pages.
  }
}

async function persistAndApply() {
  const nextSettings = cloneSettings(settings);
  await saveSettings(nextSettings);
  await applyToContent(nextSettings);
}

function applyPreset(name) {
  if (name === "reset") {
    settings = cloneSettings(DEFAULT_SETTINGS);
    return;
  }

  const preset = PRESETS[name];
  if (!preset) {
    return;
  }

  settings.preampDb = preset.preampDb;
  settings.bands = { ...createFlatBands(), ...preset.bands };
}

function refreshUiValues() {
  document.getElementById("enabled").checked = settings.enabled;
  for (const band of BANDS) {
    const slider = document.getElementById(`slider-${band.id}`);
    const valueText = document.getElementById(`value-${band.id}`);
    if (!slider || !valueText) {
      continue;
    }
    const value = getSettingValue(band.id);
    slider.value = String(value);
    valueText.textContent = formatValue(value);
  }
}

async function updateConnectionStatus() {
  if (!activeTabId) {
    setStatus("Open YouTube or YouTube Music to use EQ.", true);
    return;
  }

  try {
    const status = await browser.tabs.sendMessage(activeTabId, { type: "EQ_GET_STATUS" });
    if (status?.connected) {
      const host = status.host === "music.youtube.com" ? "YouTube Music" : "YouTube";
      setStatus(`Connected to ${host}`);
    } else {
      setStatus("No active media detected yet. Start playback.");
    }
  } catch (_) {
    setStatus("Open a video in YouTube or YouTube Music.", true);
  }
}

async function init() {
  await loadSettings();

  const tab = await getActiveTab();
  if (tab && isSupportedUrl(tab.url)) {
    activeTabId = tab.id;
  }

  document.getElementById("enabled").checked = settings.enabled;
  document.getElementById("enabled").addEventListener("change", async (event) => {
    settings.enabled = event.target.checked;
    await persistAndApply();
  });

  document.querySelector(".presets").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-preset]");
    if (!button) {
      return;
    }

    applyPreset(button.dataset.preset);
    refreshUiValues();
    await persistAndApply();
  });

  renderSliders();
  refreshUiValues();
  await applyToContent(cloneSettings(settings));
  await updateConnectionStatus();
}

init();
