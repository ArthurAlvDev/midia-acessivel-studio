'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const audit = require('../src/audit.js');

const cue = (index, start, end, text) => ({ index, start, end, text });

test('marca erro quando o CPS passa de 20', () => {
  const issues = audit.auditCue(cue(1, 0, 1000, 'a'.repeat(30)));
  const cps = issues.find((i) => i.rule === 'cps');
  assert.ok(cps, 'esperava achado de CPS');
  assert.equal(cps.severity, 'error');
});

test('marca aviso quando o CPS fica entre 17 e 20', () => {
  const issues = audit.auditCue(cue(1, 0, 1000, 'a'.repeat(18)));
  const cps = issues.find((i) => i.rule === 'cps');
  assert.equal(cps.severity, 'warning');
});

test('não reclama de CPS confortável', () => {
  const issues = audit.auditCue(cue(1, 0, 2000, 'a'.repeat(20)));
  assert.equal(issues.find((i) => i.rule === 'cps'), undefined);
});

test('marca erro de linha longa (CPL)', () => {
  const issues = audit.auditCue(cue(1, 0, 4000, 'a'.repeat(50)));
  const cpl = issues.find((i) => i.rule === 'cpl');
  assert.equal(cpl.severity, 'error');
  assert.match(cpl.message, /50 caracteres/);
});

test('conta caracteres sem tags HTML', () => {
  assert.equal(audit.plainLength('<i>abc</i>  de'), 6);
  assert.equal(audit.plainLength('  a   b  '), 3);
});

test('sinaliza trecho vazio', () => {
  const issues = audit.auditCue(cue(1, 0, 1000, '   '));
  assert.equal(issues[0].rule, 'empty');
  assert.equal(issues[0].severity, 'error');
});

test('sinaliza excesso de linhas', () => {
  const issues = audit.auditCue(cue(1, 0, 4000, 'a\nb\nc'));
  assert.ok(issues.find((i) => i.rule === 'lines'));
});

test('sinaliza duração curta e longa', () => {
  const curta = audit.auditCue(cue(1, 0, 500, 'oi'));
  assert.ok(curta.find((i) => i.rule === 'duration'));
  const longa = audit.auditCue(cue(1, 0, 9000, 'oi'));
  assert.ok(longa.find((i) => i.rule === 'duration'));
});

test('detecta sobreposição entre trechos', () => {
  const issues = audit.findOverlaps([cue(1, 0, 5000, 'a'), cue(2, 4000, 6000, 'b')]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].severity, 'error');
  assert.match(issues[0].message, /1000 ms/);
});

test('não detecta sobreposição em trechos sequenciais', () => {
  assert.equal(audit.findOverlaps([cue(1, 0, 5000, 'a'), cue(2, 5000, 6000, 'b')]).length, 0);
});

test('calcula estatísticas e índice de conformidade', () => {
  const result = audit.audit([cue(1, 0, 2000, 'Texto ok'), cue(2, 3000, 5000, 'Outro ok')]);
  assert.equal(result.stats.cues, 2);
  assert.equal(result.stats.durationMs, 5000);
  assert.equal(result.stats.score, 100);
  assert.equal(result.bySeverity.error, 0);
});

test('o índice cai com erros e avisos', () => {
  const limpo = audit.audit([cue(1, 0, 3000, 'Texto curto')]);
  const ruim = audit.audit([cue(1, 0, 1000, 'a'.repeat(40))]);
  assert.ok(ruim.stats.score < limpo.stats.score);
  assert.ok(ruim.stats.score >= 0);
});

test('o índice nunca sai de 0..100', () => {
  const cues = [];
  for (let i = 0; i < 60; i += 1) cues.push(cue(i + 1, i * 1000, i * 1000 + 500, 'x'.repeat(80)));
  const result = audit.audit(cues);
  assert.ok(result.stats.score >= 0 && result.stats.score <= 100);
});

test('encontra janelas de 3 s ou mais', () => {
  const gaps = audit.findGaps([
    cue(1, 2000, 4000, 'a'),
    cue(2, 8000, 10000, 'b'),
    cue(3, 15000, 17000, 'c'),
  ]);
  assert.equal(gaps.length, 2);
  assert.deepEqual(
    gaps.map((g) => [g.start, g.end]),
    [[4000, 8000], [10000, 15000]]
  );
});

test('inclui a janela inicial quando há silêncio antes da primeira legenda', () => {
  const gaps = audit.findGaps([cue(1, 5000, 7000, 'a')]);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].start, 0);
  assert.equal(gaps[0].end, 5000);
  assert.equal(gaps[0].afterCue, 0);
});

test('não cria janelas em legendas encadeadas', () => {
  assert.equal(audit.findGaps([cue(1, 0, 3000, 'a'), cue(2, 3000, 6000, 'b')]).length, 0);
});

test('lista vazia devolve zero janelas', () => {
  assert.deepEqual(audit.findGaps([]), []);
});
