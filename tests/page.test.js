'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('a página declara idioma e título descritivo', () => {
  assert.match(html, /<html lang="pt-BR">/);
  assert.match(html, /<title>[^<]*Legenda/);
  assert.match(html, /name="description"/);
});

test('a página tem estrutura semântica e atalho de conteúdo', () => {
  assert.match(html, /class="skip-link" href="#main"/);
  assert.match(html, /<main id="main">/);
  assert.match(html, /<header class="topbar">/);
  assert.match(html, /<footer>/);
  assert.equal((html.match(/<h1/g) || []).length, 1);
});

test('todos os arquivos citados existem', () => {
  const refs = [...html.matchAll(/(?:href|src)="([^"#]+)"/g)]
    .map((m) => m[1])
    .filter((r) => !/^https?:|^data:|^\/_vercel\//.test(r));
  assert.ok(refs.length >= 6, `esperava ao menos 6 referências locais, achei ${refs.length}`);
  for (const ref of refs) {
    assert.ok(fs.existsSync(path.join(root, ref)), `arquivo ausente: ${ref}`);
  }
});

test('a página usa status acessível para o retorno do sistema', () => {
  assert.match(html, /id="status"[^>]*role="status"/);
  assert.match(html, /aria-live="polite"/);
});

test('a página tem CSP restritiva', () => {
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src 'self'/);
  assert.match(html, /object-src 'none'/);
});

test('a página credita a OlacDev', () => {
  assert.match(html, /Made by OlacDev/);
  assert.match(html, /https:\/\/olacdev\.com\//);
});

test('todo controle de formulário tem rótulo', () => {
  const inputs = [...html.matchAll(/<input[^>]*id="([^"]+)"[^>]*>/g)].map((m) => m[1]);
  const areas = [...html.matchAll(/<textarea[^>]*id="([^"]+)"[^>]*>/g)].map((m) => m[1]);
  for (const id of [...inputs, ...areas]) {
    assert.match(html, new RegExp(`for="${id}"`), `campo sem <label for>: ${id}`);
  }
});

test('o rodapé não carrega dependências externas de terceiros', () => {
  assert.doesNotMatch(html, /google-analytics|googletagmanager|facebook\.net|hotjar/i);
});

test('o exemplo .srt é válido para o parser', () => {
  const parser = require('../src/parser.js');
  const { cues, format } = parser.parse(fs.readFileSync(path.join(root, 'exemplo.srt'), 'utf8'));
  assert.equal(format, 'srt');
  assert.equal(cues.length, 6);
});


test('a página inclui Vercel Insights, presets ANCINE/YouTube, lote e planos sem cobrança ativa', () => {
  assert.match(html, /\/_vercel\/insights\/script\.js/);
  assert.match(html, /ANCINE/);
  assert.match(html, /YouTube/);
  assert.match(html, /id="batch-subtitles"/);
  assert.match(html, /R\$ 49\/mês/);
  assert.match(html, /129–149/);
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /https:\/\/legenda\.olacdev\.com\//);
});
