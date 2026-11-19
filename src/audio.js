/* Detecção local de silêncios no áudio (Web Audio API) — sem upload. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AudioSilence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULTS = { thresholdDb: -40, minSilenceMs: 1000, windowMs: 50 };

  function detectSilenceFromSamples(samples, sampleRate, options) {
    const opts = Object.assign({}, DEFAULTS, options || {});
    const win = Math.max(1, Math.round((sampleRate * opts.windowMs) / 1000));
    const minWindows = Math.max(1, Math.round(opts.minSilenceMs / opts.windowMs));
    const windows = [];

    for (let i = 0; i + win <= samples.length; i += win) {
      let sum = 0;
      for (let j = 0; j < win; j += 1) sum += samples[i + j] * samples[i + j];
      const rms = Math.sqrt(sum / win);
      const db = 20 * Math.log10(rms || 1e-8);
      windows.push(db < opts.thresholdDb);
    }

    const found = [];
    let runStart = -1;
    for (let k = 0; k <= windows.length; k += 1) {
      const silent = k < windows.length ? windows[k] : false;
      if (silent && runStart === -1) runStart = k;
      if (!silent && runStart !== -1) {
        if (k - runStart >= minWindows) {
          found.push({
            start: runStart * opts.windowMs,
            end: k * opts.windowMs,
            duration: (k - runStart) * opts.windowMs,
          });
        }
        runStart = -1;
      }
    }
    return found;
  }

  async function decodeAudioFile(file) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    try {
      const buffer = await file.arrayBuffer();
      const audio = await ctx.decodeAudioData(buffer);
      const merged = new Float32Array(audio.length);
      for (let ch = 0; ch < audio.numberOfChannels; ch += 1) {
        const data = audio.getChannelData(ch);
        for (let i = 0; i < data.length; i += 1) merged[i] += data[i] / audio.numberOfChannels;
      }
      return { samples: merged, sampleRate: audio.sampleRate, durationMs: audio.duration * 1000 };
    } finally {
      if (ctx.close) ctx.close();
    }
  }

  return { detectSilenceFromSamples, decodeAudioFile, DEFAULTS };
});
