import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoResponse } from './handler.mjs';
import handler from '../api/demo.mjs';

test('demo API fails closed unless explicitly enabled', () => {
  for (const path of ['auth/login', 'config', 'admin/funds/ANGAINOR-DEMO-001/overview']) {
    assert.equal(demoResponse({ path }).status, 404);
  }
});
test('all writes, uploads, signup and transaction paths are rejected', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    for (const path of ['auth/signup', 'admin/funds/ANGAINOR-DEMO-001/documents', 'admin/funds/ANGAINOR-DEMO-001/distributions', 'admin/funds/ANGAINOR-DEMO-001/reset-demo']) {
      const response = demoResponse({ method, path, enabled: true });
      assert.equal(response.status, 405);
      assert.equal(JSON.parse(response.body).error.code, 'DEMO_READ_ONLY');
    }
  }
});
test('fictional records are internally consistent and unknown paths do not proxy', () => {
  const get = (path) => JSON.parse(demoResponse({ path, enabled: true }).body).data;
  const base = 'admin/funds/ANGAINOR-DEMO-001';
  const overview = get(`${base}/overview`);
  const subscriptions = get(`${base}/subscriptions`);
  assert.equal(subscriptions.reduce((sum, sub) => sum + Number(sub.committedAmount), 0), Number(overview.totalCommittedAmount));
  assert.equal(subscriptions.filter((sub) => sub.status === 'SETTLED').reduce((sum, sub) => sum + Number(sub.committedAmount), 0), Number(overview.totalSettledAmount));
  assert.equal(demoResponse({ path: 'https://production.example/api', enabled: true }).status, 404);
});
test('source content is fictional and document-specific', () => {
  const response = demoResponse({ path: 'admin/documents/side/content', enabled: true });
  assert.equal(response.status, 200);
  assert.match(response.body, /Quarterly investor reporting/);
  assert.match(response.body, /Fictional source material/);
  assert.equal(demoResponse({ path: 'admin/documents/private/content', enabled: true }).status, 404);
});
test('Vercel adapter handles rewritten routes and a disabled service', () => {
  const previous = process.env.ANGAINOR_DEMO_MODE;
  try {
    const headers = {};
    const response = { setHeader: (key, value) => { headers[key] = value; }, end: (body) => { response.body = body; } };
    process.env.ANGAINOR_DEMO_MODE = 'true';
    handler({ method: 'GET', url: '/api/demo?path=admin/funds/ANGAINOR-DEMO-001/overview' }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).data.fundName, 'Preview Real Estate Fund I');
    delete process.env.ANGAINOR_DEMO_MODE;
    handler({ method: 'POST', url: '/api/demo?path=auth/login' }, response);
    assert.equal(response.statusCode, 404);
  } finally {
    if (previous === undefined) delete process.env.ANGAINOR_DEMO_MODE;
    else process.env.ANGAINOR_DEMO_MODE = previous;
  }
});
