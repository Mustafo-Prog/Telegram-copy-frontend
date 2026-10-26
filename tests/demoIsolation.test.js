// Демо не должна ходить в API и не должна получать токен или реальные данные. Запуск: npm test
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(here, '..', 'src', rel), 'utf8');

describe('изоляция демо-режима', () => {
  const demoFiles = ['pages/DemoPage.jsx', 'demo/demoStore.js'];

  for (const file of demoFiles) {
    it(`${file} не импортирует API и не обращается к сети`, () => {
      const code = read(file);
      assert.ok(!/from\s+['"][^'"]*\/api\//.test(code), 'нет импорта из api/');
      assert.ok(!/\bfetch\s*\(/.test(code), 'нет fetch');
      assert.ok(!/\baxios\b/.test(code), 'нет axios');
      assert.ok(!/localStorage/.test(code), 'демо ничего не сохраняет в браузере');
    });
  }

  it('демо не читает токен авторизации', () => {
    for (const file of demoFiles) {
      assert.ok(!/TOKEN_KEY|tg_token|Authorization/.test(read(file)), `${file}: нет токена`);
    }
  });

  it('кнопка демо на экране входа ведёт на /demo, маршрут публичный', () => {
    assert.ok(read('pages/LoginPage.jsx').includes("navigate('/demo')"));
    const app = read('App.jsx');
    const demoLine = app.split('\n').find((l) => l.includes('path="/demo"'));
    assert.ok(demoLine, 'маршрут /demo есть');
    assert.ok(!app.slice(app.indexOf('<Route element={<ProtectedRoute'), app.indexOf('</Routes>')).includes('/demo'), 'демо вне защищённых маршрутов');
  });
});
