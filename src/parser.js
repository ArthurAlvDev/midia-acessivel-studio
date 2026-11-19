/* Parser de legendas .srt e .vtt — sem dependências, roda no navegador e no Node. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SubtitleParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TIME_RE = /(\d{1,3}:)?(\d{1,2}):(\d{2})[.,](\d{1,3})/g;

  function parseTimestamp(raw) {
    const m = String(raw).trim().match(/^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/);
    if (!m) return null;
    const h = m[1] ? parseInt(m[1], 10) : 0;
    const min = parseInt(m[2], 10);
    const sec = parseInt(m[3], 10);
    const ms = parseInt(m[4].padEnd(3, '0'), 10);
    return ((h * 60 + min) * 60 + sec) * 1000 + ms;
  }

  function formatTimestamp(ms, vtt) {
    const total = Math.max(0, Math.round(ms));
    const h = Math.floor(total / 3600000);
    const m = Math.floor((total % 3600000) / 60000);
    const s = Math.floor((total % 60000) / 1000);
    const frac = total % 1000;
    const sep = vtt ? '.' : ',';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${sep}${String(frac).padStart(3, '0')}`;
  }

  function detectFormat(text) {
    const head = String(text).trimStart().slice(0, 12).toUpperCase();
    if (head.startsWith('WEBVTT')) return 'vtt';
    if (String(text).includes('-->')) return 'srt';
    return 'unknown';
  }

  function parse(rawText) {
    const text = String(rawText || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const format = detectFormat(text);
    if (format === 'unknown') {
      throw new Error('Formato não reconhecido. Envie um arquivo .srt ou .vtt.');
    }

    let body = text;
    if (format === 'vtt') {
      body = body.replace(/^WEBVTT[^\n]*\n/, '');
      body = body.replace(/\n(?:NOTE|STYLE|REGION)[^\n]*\n[\s\S]*?(?=\n\n|$)/g, '\n');
    }

    const blocks = body.split(/\n\s*\n/);
    const cues = [];

    for (const block of blocks) {
      const lines = block.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      if (!lines.length) continue;

      const timeIdx = lines.findIndex((l) => l.includes('-->'));
      if (timeIdx === -1) continue;

      const [rawStart, rawEnd] = lines[timeIdx].split('-->');
      const start = parseTimestamp(rawStart);
      const end = parseTimestamp((rawEnd || '').trim().split(/\s+/)[0]);
      if (start === null || end === null) continue;

      const content = lines
        .slice(timeIdx + 1)
        .join('\n')
        .replace(/\{\\[^}]*\}/g, '')
        .trim();
      if (!content) continue;

      cues.push({
        index: cues.length + 1,
        id: timeIdx > 0 ? lines[0] : '',
        start,
        end,
        text: content,
      });
    }

    if (!cues.length) throw new Error('Nenhuma legenda válida encontrada no arquivo.');
    cues.sort((a, b) => a.start - b.start);
    cues.forEach((c, i) => (c.index = i + 1));
    return { format, cues };
  }

  function toVTT(segments) {
    const header = 'WEBVTT\n\n';
    const body = segments
      .map(
        (s, i) =>
          `${i + 1}\n${formatTimestamp(s.start, true)} --> ${formatTimestamp(s.end, true)}\n${s.text}`
      )
      .join('\n\n');
    return header + body + '\n';
  }

  return { parse, parseTimestamp, formatTimestamp, detectFormat, toVTT };
});
