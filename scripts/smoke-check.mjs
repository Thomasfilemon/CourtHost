// Small render check; browser APIs below are mocks, not an actual browser.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const saved = new Map();
globalThis.localStorage = {getItem: k => saved.get(k), setItem: (k,v) => saved.set(k,v)};
globalThis.document = {documentElement: {lang: ''}};
const server = await createServer({server:{middlewareMode:true},appType:'custom'});
try {
  await server.ssrLoadModule('/src/lib/i18n/index.ts');
  const { App } = await server.ssrLoadModule('/src/app/App.tsx');
  const { default: i18n } = await import('i18next');
  assert.match(renderToStaticMarkup(createElement(App)), /More tennis/);
  await i18n.changeLanguage('id');
  assert.match(renderToStaticMarkup(createElement(App)), /Fokus main/);
  assert.equal(document.documentElement.lang, 'id');
  assert.equal(saved.get('courthost.language'), 'id');
  console.log('PASS: React renders EN and ID; language updates document and storage.');
} finally { await server.close(); }
