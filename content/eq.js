(() => {
  const STORAGE_KEY = "ytLiveEqSettings";

  const BAND_DEFS = [
    { id: "b60", label: "60Hz", frequency: 60, q: 1.0 },
    { id: "b170", label: "170Hz", frequency: 170, q: 1.0 },
    { id: "b350", label: "350Hz", frequency: 350, q: 1.0 },
    { id: "b1k", label: "1kHz", frequency: 1000, q: 1.0 },
    { id: "b35k", label: "3.5kHz", frequency: 3500, q: 1.0 }
  ];

  const BAND_IDS = BAND_DEFS.map((band) => band.id);

  function createFlatBands() {
    return BAND_IDS.reduce((acc, id) => {
      acc[id] = 0;
      return acc;
    }, {});
  }

  const DEFAULT_SETTINGS = {
    enabled: true,
    preampDb: 0,
    bands: createFlatBands()
  };

  let settings = cloneSettings(DEFAULT_SETTINGS);
  let currentVideo = null;
  let audioContext = null;
  let sourceNode = null;
  let preampNode = null;
  let filterNodes = {};
  let mutationObserver = null;

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

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function dBToLinear(db) {
    return Math.pow(10, db / 20);
  }

  function getBestVideoElement() {
    const videos = Array.from(document.querySelectorAll("video"));
    if (videos.length === 0) {
      return null;
    }

    const playing = videos.find((video) => !video.paused && !video.ended);
    if (playing) {
      return playing;
    }

    return videos[0];
  }

  function ensureContext() {
    if (!audioContext) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) {
        return null;
      }
      audioContext = new Ctor();
    }
    return audioContext;
  }

  function tryResumeContext() {
    if (audioContext && audioContext.state === "suspended") {
      audioContext.resume().catch(() => {
        // User gesture requirements can prevent resume.
      });
    }
  }

  function teardownGraph() {
    if (sourceNode) {
      try {
        sourceNode.disconnect();
      } catch (_) {}
    }

    if (preampNode) {
      try {
        preampNode.disconnect();
      } catch (_) {}
    }

    Object.values(filterNodes).forEach((node) => {
      try {
        node.disconnect();
      } catch (_) {}
    });

    sourceNode = null;
    preampNode = null;
    filterNodes = {};
  }

  function bindVideoListeners(video) {
    video.addEventListener("play", tryResumeContext, { passive: true });
    video.addEventListener("volumechange", tryResumeContext, { passive: true });
    document.addEventListener("click", tryResumeContext, { passive: true });
    document.addEventListener("keydown", tryResumeContext);
  }

  function buildGraph(video) {
    if (!video) {
      return;
    }

    if (currentVideo === video && sourceNode) {
      return;
    }

    const ctx = ensureContext();
    if (!ctx) {
      return;
    }

    teardownGraph();
    currentVideo = video;

    sourceNode = ctx.createMediaElementSource(video);
    preampNode = ctx.createGain();

    sourceNode.connect(preampNode);

    let prev = preampNode;
    BAND_DEFS.forEach((band) => {
      const filter = ctx.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = band.frequency;
      filter.Q.value = band.q;
      filter.gain.value = 0;
      prev.connect(filter);
      prev = filter;
      filterNodes[band.id] = filter;
    });

    prev.connect(ctx.destination);
    applySettingsToGraph();
    bindVideoListeners(video);
    tryResumeContext();
  }

  function applySettingsToGraph() {
    if (!preampNode) {
      return;
    }

    const enabled = settings.enabled;
    const preampDb = enabled ? clamp(settings.preampDb, -12, 12) : 0;
    preampNode.gain.value = dBToLinear(preampDb);

    BAND_DEFS.forEach((band) => {
      const node = filterNodes[band.id];
      if (!node) {
        return;
      }
      const gain = enabled ? clamp(settings.bands[band.id] ?? 0, -12, 12) : 0;
      node.gain.value = gain;
    });
  }

  function attachToCurrentVideo() {
    const video = getBestVideoElement();
    if (!video) {
      return;
    }
    buildGraph(video);
  }

  function startObservers() {
    if (!mutationObserver) {
      let pending = false;
      mutationObserver = new MutationObserver(() => {
        if (pending) {
          return;
        }
        pending = true;
        requestAnimationFrame(() => {
          pending = false;
          attachToCurrentVideo();
        });
      });

      mutationObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    window.addEventListener("yt-navigate-finish", attachToCurrentVideo);
    window.addEventListener("popstate", attachToCurrentVideo);
  }

  async function loadSavedSettings() {
    try {
      const data = await browser.storage.local.get(STORAGE_KEY);
      if (data && data[STORAGE_KEY]) {
        settings = cloneSettings(data[STORAGE_KEY]);
      }
    } catch (_) {
      // Keep defaults when storage is unavailable.
    }
  }

  function isSupportedHost() {
    return (
      location.hostname === "www.youtube.com" ||
      location.hostname === "music.youtube.com"
    );
  }

  browser.runtime.onMessage.addListener((message) => {
    if (!message || typeof message !== "object") {
      return undefined;
    }

    if (message.type === "EQ_GET_STATUS") {
      return Promise.resolve({
        connected: Boolean(currentVideo && sourceNode),
        host: location.hostname,
        enabled: settings.enabled
      });
    }

    if (message.type === "EQ_SET_SETTINGS") {
      settings = cloneSettings(message.payload || DEFAULT_SETTINGS);
      applySettingsToGraph();
      return Promise.resolve({ ok: true });
    }

    return undefined;
  });

  async function init() {
    if (!isSupportedHost()) {
      return;
    }

    await loadSavedSettings();
    startObservers();
    attachToCurrentVideo();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        attachToCurrentVideo();
      }
    });
  }

  init();
})();
