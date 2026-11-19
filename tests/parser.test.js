'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const parser = require('../src/parser.js');

const SRT = `1
00:00:02,000 --> 00:00:05,400
- Você viu o que aconteceu?
- Não, cheguei agora.

2
00:00:06,000 --> 00:00:10,200
A porta bateu forte.

3
00:00:15,000 --> 00:00:18,000
[música tensa]
`;

test('detecta formato SRT e VTT', () => {
  assert.equal(parser.detectFormat(SRT), 'srt');
  assert.equal(parser.detectFormat('WEBVTT\n\n00:01.000 --> 00:02.000\nOi\n'), 'vtt');
  assert.equal(parser.detectFormat('texto qualquer'), 'unknown');
});

test('converte timestamps em milissegundos', () => {
  assert.equal(parser.parseTimestamp('00:00:02,500'), 2500);
  assert.equal(parser.parseTimestamp('01:02:03.250'), 3723250);
  assert.equal(parser.parseTimestamp('02:03.250'), 123250);
  assert.equal(parser.parseTimestamp('invalido'), null);
});

test('formata timestamps de ida e volta', () => {
  assert.equal(parser.formatTimestamp(2500), '00:00:02,500');
  assert.equal(parser.formatTimestamp(2500, true), '00:00:02.500');
  const back = parser.parseTimestamp(parser.formatTimestamp(3723250));
  assert.equal(back, 3723250);
});

test('faz o parse de SRT com índices e textos', () => {
  const { format, cues } = parser.parse(SRT);
  assert.equal(format, 'srt');
  assert.equal(cues.length, 3);
  assert.equal(cues[0].start, 2000);
  assert.equal(cues[0].end, 5400);
  assert.match(cues[0].text, /cheguei agora/);
  assert.equal(cues[2].text, '[música tensa]');
});

test('ordena os trechos por tempo de início', () => {
  const fora = `1
00:00:10,000 --> 00:00:12,000
Depois

2
00:00:01,000 --> 00:00:02,000
Antes
`;
  const { cues } = parser.parse(fora);
  assert.equal(cues[0].text, 'Antes');
  assert.equal(cues[0].index, 1);
  assert.equal(cues[1].index, 2);
});

test('faz o parse de VTT ignorando cabeçalho e notas', () => {
  const vtt = `WEBVTT - exemplo

NOTE isto é um comentário
que ocupa duas linhas

cue-1
00:00:01.000 --> 00:00:03.500 align:start
Primeira linha

00:00:04.000 --> 00:00:06.000
Segunda linha
`;
  const { format, cues } = parser.parse(vtt);
  assert.equal(format, 'vtt');
  assert.equal(cues.length, 2);
  assert.equal(cues[0].id, 'cue-1');
  assert.equal(cues[0].start, 1000);
});

test('remove tags de posicionamento', () => {
  const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n{\\an8}Texto limpo\n';
  const { cues } = parser.parse(vtt);
  assert.equal(cues[0].text, 'Texto limpo');
});

test('rejeita formato desconhecido', () => {
  assert.throws(() => parser.parse('nada aqui'), /Formato não reconhecido/);
});

test('rejeita arquivo sem trechos válidos', () => {
  assert.throws(() => parser.parse('WEBVTT\n\nsem tempo\n'), /Nenhuma legenda válida/);
});

test('gera VTT válido a partir de segmentos', () => {
  const out = parser.toVTT([{ start: 1000, end: 2500, text: 'Oi' }]);
  assert.ok(out.startsWith('WEBVTT\n\n'));
  assert.match(out, /00:00:01\.000 --> 00:00:02\.500/);
  assert.match(out, /Oi/);
});

test('lida com BOM e CRLF', () => {
  const comBom = '\uFEFF1\r\n00:00:01,000 --> 00:00:02,000\r\nOi\r\n';
  const { cues } = parser.parse(comBom);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].text, 'Oi');
});
