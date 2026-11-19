'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const parser = require('../src/parser.js');
const audit = require('../src/audit.js');
const studio = require('../src/descriptions.js');

const SRT = `1
00:00:02,000 --> 00:00:05,400
- Você viu o que aconteceu?

2
00:00:06,000 --> 00:00:10,200
A porta bateu forte.

3
00:00:15,000 --> 00:00:18,000
[música tensa]
`;

test('formata relógio com e sem horas', () => {
  assert.equal(studio.formatClock(5000), '00:05');
  assert.equal(studio.formatClock(65000), '01:05');
  assert.equal(studio.formatClock(3725000), '1:02:05');
});

test('gera trilha de audiodescrição apenas com rascunhos preenchidos', () => {
  const cues = parser.parse(SRT).cues;
  const gaps = audit.findGaps(cues);
  const drafts = gaps.map((_, i) => (i === 0 ? 'Sala escura com duas cadeiras.' : ''));
  const vtt = studio.descriptionsVTT(gaps, drafts);
  assert.ok(vtt.startsWith('WEBVTT'));
  assert.match(vtt, /Sala escura com duas cadeiras\./);
  assert.equal((vtt.match(/-->/g) || []).length, 1);
});

test('a descrição começa depois do início da janela', () => {
  const gaps = [{ start: 10000, end: 15000, duration: 5000, afterCue: 1 }];
  const built = studio.buildDescriptionCues(gaps, ['Ele abre a porta.']);
  assert.equal(built.length, 1);
  assert.ok(built[0].start > gaps[0].start);
  assert.equal(built[0].end, 15000);
  assert.ok(built[0].start < built[0].end);
});

test('ignora rascunhos vazios ou só com espaços', () => {
  const gaps = [{ start: 0, end: 5000, duration: 5000, afterCue: 0 }];
  assert.equal(studio.buildDescriptionCues(gaps, ['   ']).length, 0);
  assert.equal(studio.buildDescriptionCues(gaps, []).length, 0);
});

test('gera transcrição descritiva ordenada no tempo', () => {
  const cues = parser.parse(SRT).cues;
  const gaps = audit.findGaps(cues);
  const drafts = gaps.map((_, i) => (i === 0 ? 'Cena urbana à noite.' : ''));
  const txt = studio.transcript(cues, gaps, drafts);
  assert.match(txt, /\[\d{2}:\d{2}\] AUDIODESCRIÇÃO: Cena urbana à noite\./);
  assert.match(txt, /\[00:02\]/);
  const linhas = txt.trim().split('\n');
  const tempos = linhas.map((l) => l.match(/\[(\d+):(\d+)\]/)).map((m) => Number(m[1]) * 60 + Number(m[2]));
  assert.deepEqual(tempos, [...tempos].sort((a, b) => a - b));
});

test('o relatório contém estatísticas, achados e janelas', () => {
  const cues = parser.parse(SRT).cues;
  const result = audit.audit(cues);
  const gaps = audit.findGaps(cues);
  const md = studio.reportMarkdown({
    fileName: 'exemplo.srt',
    format: 'srt',
    auditResult: result,
    gaps,
    drafts: gaps.map((_, i) => (i === 0 ? 'Descrição um.' : '')),
  });
  assert.match(md, /# Relatório de auditoria — exemplo\.srt/);
  assert.match(md, /Formato: \*\*SRT\*\*/);
  assert.match(md, /## Achados/);
  assert.match(md, /## Janelas para audiodescrição/);
  assert.match(md, /Descrição um\./);
  assert.match(md, /Nota metodológica/);
});

test('o relatório aguenta auditoria sem achados', () => {
  const cues = parser.parse(SRT).cues;
  const result = { issues: [], bySeverity: { error: 0, warning: 0 }, stats: audit.audit(cues).stats };
  const md = studio.reportMarkdown({ fileName: 'x.srt', format: 'srt', auditResult: result, gaps: [], drafts: [] });
  assert.match(md, /Nenhum problema encontrado/);
});
