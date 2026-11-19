'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const audio = require('../src/audio.js');

const SR = 1000; // 1 amostra = 1 ms, simplifica a conta

function silence(ms) {
  return new Float32Array(ms);
}

function tone(ms, amp = 0.5) {
  const out = new Float32Array(ms);
  for (let i = 0; i < ms; i += 1) out[i] = Math.sign(Math.sin((2 * Math.PI * 220 * i) / SR)) * amp;
  return out;
}

function concat(...parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const opts = { minSilenceMs: 1000, windowMs: 50, thresholdDb: -40 };

test('detecta um silêncio cercado por som', () => {
  const samples = concat(tone(2000), silence(2000), tone(2000));
  const found = audio.detectSilenceFromSamples(samples, SR, opts);
  assert.equal(found.length, 1);
  assert.ok(Math.abs(found[0].start - 2000) <= 100);
  assert.ok(Math.abs(found[0].end - 4000) <= 100);
  assert.ok(found[0].duration >= 1500);
});

test('ignora silêncios curtos', () => {
  const samples = concat(tone(2000), silence(500), tone(2000));
  assert.equal(audio.detectSilenceFromSamples(samples, SR, opts).length, 0);
});

test('detecta silêncio que termina no fim do arquivo', () => {
  const samples = concat(tone(2000), silence(3000));
  const found = audio.detectSilenceFromSamples(samples, SR, opts);
  assert.equal(found.length, 1);
  assert.ok(found[0].end >= 4900);
});

test('áudio todo silencioso vira um único bloco', () => {
  const found = audio.detectSilenceFromSamples(silence(5000), SR, opts);
  assert.equal(found.length, 1);
  assert.equal(found[0].start, 0);
});

test('áudio todo com som não gera silêncios', () => {
  assert.equal(audio.detectSilenceFromSamples(tone(5000), SR, opts).length, 0);
});

test('amostras vazias não quebram', () => {
  assert.deepEqual(audio.detectSilenceFromSamples(new Float32Array(0), SR, opts), []);
});

test('o limiar maior detecta mais silêncio', () => {
  const baixo = tone(3000, 0.05);
  const estrito = audio.detectSilenceFromSamples(baixo, SR, { ...opts, thresholdDb: -40 });
  const frouxo = audio.detectSilenceFromSamples(baixo, SR, { ...opts, thresholdDb: -20 });
  assert.equal(estrito.length, 0);
  assert.equal(frouxo.length, 1);
});

test('expoe os padrões documentados', () => {
  assert.equal(audio.DEFAULTS.thresholdDb, -40);
  assert.equal(audio.DEFAULTS.minSilenceMs, 1000);
});
