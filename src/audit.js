/* Auditoria determinística de legendas: CPS, CPL, linhas, duração, sobreposição. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SubtitleAudit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LIMITS = {
    cpsError: 20, // caracteres por segundo (Netflix/EBU: 17-20)
    cpsWarn: 17,
    cplError: 46, // caracteres por linha
    cplWarn: 42,
    maxLines: 2,
    minDurationMs: 1000,
    maxDurationMs: 7000,
    minGapMs: 3000, // janela mínima para audiodescrição
  };

  const RULES = {
    cps: { label: 'Velocidade de leitura (CPS)', ref: 'WCAG 1.2.2 / EBU R128' },
    cpl: { label: 'Comprimento de linha (CPL)', ref: 'Recomendação de legibilidade' },
    lines: { label: 'Número de linhas', ref: 'Recomendação de legibilidade' },
    duration: { label: 'Duração do trecho', ref: 'Boas práticas de legendagem' },
    overlap: { label: 'Sobreposição de tempo', ref: 'WCAG 1.2.2' },
    empty: { label: 'Trecho vazio', ref: 'WCAG 1.2.2' },
    gap: { label: 'Intervalo para audiodescrição', ref: 'WCAG 1.2.5' },
  };

  function plainLength(text) {
    return String(text).replace(/\s+/g, ' ').replace(/<[^>]+>/g, '').trim().length;
  }

  function auditCue(cue) {
    const issues = [];
    const text = String(cue.text || '');
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const chars = plainLength(text);
    const duration = Math.max(0, cue.end - cue.start);
    const seconds = duration / 1000;

    if (!chars) {
      issues.push({ cue: cue.index, rule: 'empty', severity: 'error', message: 'Trecho sem texto.' });
      return issues;
    }

    if (seconds > 0) {
      const cps = chars / seconds;
      if (cps > LIMITS.cpsError) {
        issues.push({
          cue: cue.index,
          rule: 'cps',
          severity: 'error',
          message: `${cps.toFixed(1)} CPS acima do limite de ${LIMITS.cpsError}.`,
          suggestion: 'Divida o trecho ou aumente a duração.',
        });
      } else if (cps > LIMITS.cpsWarn) {
        issues.push({
          cue: cue.index,
          rule: 'cps',
          severity: 'warning',
          message: `${cps.toFixed(1)} CPS acima do recomendado (${LIMITS.cpsWarn}).`,
        });
      }
    }

    const longest = lines.reduce((max, l) => Math.max(max, plainLength(l)), 0);
    if (longest > LIMITS.cplError) {
      issues.push({
        cue: cue.index,
        rule: 'cpl',
        severity: 'error',
        message: `Linha com ${longest} caracteres (limite ${LIMITS.cplError}).`,
        suggestion: 'Quebre a linha em duas.',
      });
    } else if (longest > LIMITS.cplWarn) {
      issues.push({
        cue: cue.index,
        rule: 'cpl',
        severity: 'warning',
        message: `Linha com ${longest} caracteres (recomendado até ${LIMITS.cplWarn}).`,
      });
    }

    if (lines.length > LIMITS.maxLines) {
      issues.push({
        cue: cue.index,
        rule: 'lines',
        severity: 'warning',
        message: `${lines.length} linhas no mesmo trecho (máximo ${LIMITS.maxLines}).`,
      });
    }

    if (duration < LIMITS.minDurationMs) {
      issues.push({
        cue: cue.index,
        rule: 'duration',
        severity: 'warning',
        message: `Duração de ${duration} ms, curta demais.`,
      });
    } else if (duration > LIMITS.maxDurationMs) {
      issues.push({
        cue: cue.index,
        rule: 'duration',
        severity: 'warning',
        message: `Duração de ${(duration / 1000).toFixed(1)} s, longa demais para um trecho.`,
      });
    }

    return issues;
  }

  function findOverlaps(cues) {
    const issues = [];
    for (let i = 1; i < cues.length; i += 1) {
      const prev = cues[i - 1];
      const cur = cues[i];
      if (cur.start < prev.end) {
        issues.push({
          cue: cur.index,
          rule: 'overlap',
          severity: 'error',
          message: `Começa ${prev.end - cur.start} ms antes do fim do trecho ${prev.index}.`,
        });
      }
    }
    return issues;
  }

  function audit(cues) {
    const perCue = [];
    for (const cue of cues) perCue.push(...auditCue(cue));
    const issues = perCue.concat(findOverlaps(cues));

    const bySeverity = { error: 0, warning: 0 };
    for (const issue of issues) bySeverity[issue.severity] += 1;

    const totalChars = cues.reduce((sum, c) => sum + plainLength(c.text), 0);
    const totalMs = cues.reduce((sum, c) => sum + Math.max(0, c.end - c.start), 0);
    const avgCps = totalMs > 0 ? totalChars / (totalMs / 1000) : 0;

    let score = 100;
    score -= bySeverity.error * 4;
    score -= bySeverity.warning * 1.5;
    score = Math.max(0, Math.min(100, Math.round(score)));

    return {
      issues,
      bySeverity,
      stats: {
        cues: cues.length,
        chars: totalChars,
        durationMs: cues.reduce((max, c) => Math.max(max, c.end), 0),
        avgCps: Number(avgCps.toFixed(1)),
        score,
      },
    };
  }

  function findGaps(cues, minGapMs = LIMITS.minGapMs) {
    const gaps = [];
    if (!cues.length) return gaps;

    if (cues[0].start >= minGapMs) {
      gaps.push({ start: 0, end: cues[0].start, duration: cues[0].start, afterCue: 0 });
    }
    for (let i = 1; i < cues.length; i += 1) {
      const start = cues[i - 1].end;
      const end = cues[i].start;
      if (end - start >= minGapMs) {
        gaps.push({ start, end, duration: end - start, afterCue: cues[i - 1].index });
      }
    }
    return gaps;
  }

  return { audit, auditCue, findOverlaps, findGaps, plainLength, LIMITS, RULES };
});
