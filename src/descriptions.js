/* Geração de trilha de audiodescrição (.vtt), transcrição descritiva e relatório. */
(function (root, factory) {
  const deps =
    typeof module === 'object' && module.exports
      ? { parser: require('./parser.js') }
      : { parser: root.SubtitleParser };
  const api = factory(deps.parser);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DescriptionStudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (parser) {
  'use strict';

  function buildDescriptionCues(gaps, drafts) {
    return gaps
      .map((gap, i) => {
        const text = String((drafts && drafts[i]) || '').trim();
        if (!text) return null;
        const start = gap.start + Math.min(500, Math.max(0, Math.floor((gap.duration - 1000) / 4)));
        return { start, end: gap.end, text };
      })
      .filter(Boolean);
  }

  function descriptionsVTT(gaps, drafts) {
    return parser.toVTT(buildDescriptionCues(gaps, drafts));
  }

  function formatClock(ms) {
    const total = Math.round(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const base = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return h > 0 ? `${h}:${base}` : base;
  }

  function transcript(cues, gaps, drafts) {
    const lines = [];
    gaps.forEach((gap, i) => {
      const text = String((drafts && drafts[i]) || '').trim();
      if (text) lines.push({ start: gap.start, kind: 'ad', text });
    });
    cues.forEach((c) => lines.push({ start: c.start, kind: 'fala', text: c.text.replace(/\n/g, ' ') }));
    lines.sort((a, b) => a.start - b.start);
    return lines
      .map((l) => `[${formatClock(l.start)}] ${l.kind === 'ad' ? 'AUDIODESCRIÇÃO: ' : ''}${l.text}`)
      .join('\n') + '\n';
  }

  function reportMarkdown({ fileName, format, auditResult, gaps, drafts }) {
    const s = auditResult.stats;
    const filled = (drafts || []).filter((d) => String(d || '').trim()).length;
    const head = [
      `# Relatório de auditoria — ${fileName || 'legenda'}`,
      '',
      `- Formato: **${String(format || '').toUpperCase()}**`,
      `- Trechos: **${s.cues}**`,
      `- Duração coberta: **${formatClock(s.durationMs)}**`,
      `- CPS médio: **${s.avgCps}**`,
      `- Erros: **${auditResult.bySeverity.error}** · Avisos: **${auditResult.bySeverity.warning}**`,
      `- Índice de conformidade: **${s.score}/100**`,
      '',
      '## Achados',
      '',
    ];
    const rows = auditResult.issues.length
      ? auditResult.issues.map(
          (i) =>
            `- **Trecho ${i.cue}** · ${i.severity === 'error' ? 'erro' : 'aviso'} · ${i.rule}: ${i.message}${i.suggestion ? ` _(${i.suggestion})_` : ''}`
        )
      : ['- Nenhum problema encontrado nas regras verificadas.'];

    const ad = [
      '',
      '## Janelas para audiodescrição',
      '',
      `Janelas com pelo menos 3 s: **${gaps.length}**. Com descrição escrita: **${filled}**.`,
      '',
    ];
    gaps.forEach((g, i) => {
      const text = String((drafts && drafts[i]) || '').trim();
      ad.push(
        `- ${formatClock(g.start)} – ${formatClock(g.end)} (${(g.duration / 1000).toFixed(1)} s): ${text || '_sem descrição_'}`
      );
    });

    ad.push('', '## Nota metodológica', '');
    ad.push(
      'Auditoria determinística: CPS = caracteres ÷ segundos; CPL = maior linha; janelas = intervalos entre legendas com 3 s ou mais. Nenhum dado saiu do navegador.'
    );
    return head.concat(rows, ad).join('\n') + '\n';
  }

  return { buildDescriptionCues, descriptionsVTT, transcript, reportMarkdown, formatClock };
});
