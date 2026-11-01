const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const { PDFDocument } = require('pdf-lib');
const { createCanvas } = require('@napi-rs/canvas');
const XLSX = require('xlsx');
const { createSandboxApp } = require('../dist-sandbox/sandbox/main');
const { SandboxDatabase } = require('../dist-sandbox/sandbox/database');
const { SandboxWorker } = require('../dist-sandbox/sandbox/worker');
const { parseDocument } = require('../dist-sandbox/sandbox/parser');
const { simplePdf } = require('../dist-sandbox/sandbox/seed');
const { allocate } = require('../dist-sandbox/sandbox/calculations');
const { fingerprint } = require('../dist-sandbox/sandbox/types');
let app, server, db, folder, a, b;
async function req(
  path,
  method = 'GET',
  body,
  cookie,
  key = randomUUID(),
  headers = {},
) {
  const response = await server.inject({
    method,
    url: '/api/v1/sandbox' + path,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(method !== 'GET' ? { 'idempotency-key': key } : {}),
      ...headers,
    },
    payload: body,
  });
  return {
    status: response.statusCode,
    body: response.headers['content-type']?.includes('json')
      ? response.json()
      : response.body,
    headers: response.headers,
  };
}
async function account(email) {
  const r = await req('/auth/register', 'POST', {
    name: email.split('@')[0],
    email,
    password: 'test-password-long-enough',
    inviteCode: 'test-invitation-only',
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const cookie = r.headers['set-cookie'].split(';')[0];
  const state = await req('/state', 'GET', undefined, cookie);
  assert.equal(state.status, 200, JSON.stringify(state.body));
  return {
    cookie,
    user: r.body,
    state: state.body,
    f: `/funds/${state.body.fund.id}`,
  };
}
before(async () => {
  folder = await mkdtemp(join(tmpdir(), 'angainor-test-'));
  process.env.SANDBOX_DATA_DIR = folder;
  process.env.SANDBOX_INVITE_CODE = 'test-invitation-only';
  app = await createSandboxApp();
  await app.init();
  server = app.getHttpAdapter().getInstance();
  await server.ready();
  db = app.get(SandboxDatabase);
  a = await account('alpha@example.test');
  b = await account('beta@example.test');
});
after(async () => {
  await app?.close();
  await rm(folder, { recursive: true, force: true });
});
test('portfolio, onboarding and conversations stay persistent and fund scoped', async () => {
  const user = await account('control-room@example.test');
  const created = await req(
    '/funds',
    'POST',
    {
      name: 'Onboarding test fund',
      currency: 'USD',
      strategy: 'Real estate',
      reviewerEmail: 'reviewer@example.test',
    },
    user.cookie,
  );
  assert.equal(created.status, 201);
  const f = `/funds/${created.body.id}`;
  let state = (
    await req(`/state?fundId=${created.body.id}`, 'GET', undefined, user.cookie)
  ).body;
  assert.equal(state.fund.onboarding.reviewerStatus, 'CONTACT_ONLY');
  assert.equal(state.fund.onboarding.step, 2);
  assert.equal(
    (
      await req(
        f + '/onboarding/confirm',
        'POST',
        { revision: 1, documentIds: [], reason: 'Checked package' },
        user.cookie,
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await req(
        f + '/onboarding/confirm',
        'POST',
        { revision: 1, documentIds: [], reason: 'Checked package' },
        b.cookie,
      )
    ).status,
    404,
  );
  const seed = user.state;
  const confirmed = await req(
    user.f + '/onboarding/confirm',
    'POST',
    {
      revision: seed.fund.revision,
      documentIds: seed.documents.map((d) => d.id),
      reason:
        'Checked synthetic types and dates; no rules automatically approved.',
    },
    user.cookie,
  );
  assert.equal(confirmed.status, 201, JSON.stringify(confirmed.body));
  assert.equal(
    (
      await req(
        user.f + '/onboarding/confirm',
        'POST',
        {
          revision: seed.fund.revision,
          documentIds: seed.documents.map((d) => d.id),
          reason: 'Stale',
        },
        user.cookie,
      )
    ).status,
    409,
  );
  state = (
    await req(`/state?fundId=${seed.fund.id}`, 'GET', undefined, user.cookie)
  ).body;
  assert.equal(state.fund.onboarding.step, 4);
  assert.equal(state.rulebook.version, seed.rulebook.version);
  assert.equal(state.fund.onboarding.documents.length, seed.documents.length);
  const portfolio = (await req('/portfolio', 'GET', undefined, user.cookie))
    .body;
  assert.equal(portfolio.funds.length, 2);
  assert.equal(
    portfolio.funds.find((r) => r.id === created.body.id).documents,
    0,
  );
  assert.ok(portfolio.funds.every((r) => r.org_id === user.user.orgId));
  assert.equal(
    (await req('/portfolio', 'GET', undefined, b.cookie)).body.funds.some(
      (r) => r.id === seed.fund.id,
    ),
    false,
  );
  const first = await req(
    user.f + '/questions',
    'POST',
    { question: 'What are total commitments?', asOf: '2026-11-01' },
    user.cookie,
  );
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const conversationId = first.body.conversationId;
  assert.ok(conversationId);
  const second = await req(
    user.f + '/questions',
    'POST',
    {
      question: 'What are total contributions?',
      asOf: '2026-11-01',
      conversationId,
    },
    user.cookie,
  );
  assert.equal(second.status, 201);
  assert.equal(second.body.conversationId, conversationId);
  const history = await req(
    user.f + '/conversations/' + conversationId,
    'GET',
    undefined,
    user.cookie,
  );
  assert.equal(history.body.answers.length, 2);
  assert.equal(history.body.answers[0].id, first.body.id);
  assert.equal(
    (
      await req(
        f + '/questions',
        'POST',
        {
          question: 'What are total commitments?',
          asOf: '2026-11-01',
          conversationId,
        },
        user.cookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await req(
        user.f + '/conversations/' + conversationId,
        'GET',
        undefined,
        b.cookie,
      )
    ).status,
    404,
  );
  await db.as(b.user.orgId, async () =>
    assert.equal(
      (
        await db.query('SELECT id FROM sb_conversations WHERE id=$1', [
          conversationId,
        ])
      ).rows.length,
      0,
    ),
  );
  const legacyId = randomUUID();
  await db.query(
    'INSERT INTO sb_answers(id,org_id,fund_id,question,answer,actor_id) VALUES($1,$2,$3,$4,$5::jsonb,$6)',
    [
      legacyId,
      user.user.orgId,
      seed.fund.id,
      'Earlier immutable question',
      JSON.stringify(first.body.answer),
      user.user.id,
    ],
  );
  assert.equal(
    (
      await req(
        user.f + '/questions',
        'POST',
        {
          question: 'What are total commitments?',
          asOf: '2026-11-01',
          conversationId: legacyId,
        },
        user.cookie,
      )
    ).status,
    201,
  );
  const legacy = (
    await req(
      user.f + '/conversations/' + legacyId,
      'GET',
      undefined,
      user.cookie,
    )
  ).body;
  assert.equal(legacy.answers.length, 2);
  assert.equal(
    legacy.answers.find((answer) => answer.id === legacyId).conversation_id,
    null,
  );
});
test('registration is invite-only, cookie authenticated, and personal', async () => {
  assert.notEqual(a.user.orgId, b.user.orgId);
  assert.notEqual(a.state.fund.id, b.state.fund.id);
  assert.equal((await req('/state')).status, 401);
  assert.equal(
    (
      await req('/auth/register', 'POST', {
        email: 'other@example.test',
        password: 'long-enough-password',
        name: 'Other',
        inviteCode: 'wrong',
      })
    ).status,
    403,
  );
  assert.equal(a.state.records.filter((r) => r.kind === 'investor').length, 6);
});
test('API, original files and RLS independently prevent cross-sandbox access', async () => {
  assert.equal(
    (await req(`/state?fundId=${a.state.fund.id}`, 'GET', undefined, b.cookie))
      .status,
    404,
  );
  assert.equal(
    (
      await req(
        `${a.f}/documents/${a.state.documents[0].id}/content`,
        'GET',
        undefined,
        b.cookie,
      )
    ).status,
    404,
  );
  const result = await db.as(b.user.orgId, () =>
    db.query('SELECT * FROM sb_records WHERE org_id=$1', [a.user.orgId]),
  );
  assert.equal(result.rows.length, 0);
});
test('cross-site mutations and read-only membership writes are rejected', async () => {
  assert.equal(
    (
      await req(
        '/funds',
        'POST',
        { name: 'Bad', currency: 'USD' },
        a.cookie,
        randomUUID(),
        { origin: 'https://evil.example' },
      )
    ).status,
    403,
  );
  await db.query("UPDATE sb_memberships SET role='reader' WHERE user_id=$1", [
    b.user.id,
  ]);
  assert.equal(
    (await req('/funds', 'POST', { name: 'Bad', currency: 'USD' }, b.cookie))
      .status,
    403,
  );
  await db.query("UPDATE sb_memberships SET role='owner' WHERE user_id=$1", [
    b.user.id,
  ]);
});
test('idempotency prevents duplicate records and rejects key reuse with changed inputs', async () => {
  const body = { data: { name: 'Third SPV', jurisdiction: 'Delaware' } };
  const key = randomUUID();
  const first = await req(a.f + '/records/spv', 'POST', body, a.cookie, key);
  assert.equal(first.status, 201);
  assert.deepEqual(
    (await req(a.f + '/records/spv', 'POST', body, a.cookie, key)).body,
    first.body,
  );
  assert.equal(
    (
      await req(
        a.f + '/records/spv',
        'POST',
        { data: { name: 'Changed', jurisdiction: '' } },
        a.cookie,
        key,
      )
    ).status,
    409,
  );
});
test('money validation rejects floating precision and zero amounts', async () => {
  for (const amount of ['0', '1.001', 'NaN', '-1', 1.5])
    assert.equal(
      (
        await req(
          a.f + '/calls',
          'POST',
          {
            amount,
            purpose: 'operating',
            asOf: '2026-11-01',
            dueDate: '2026-11-25',
          },
          a.cookie,
        )
      ).status,
      422,
    );
});
test('calculation, stale approval, recalculation, approval and exports preserve exact evidence', async () => {
  const draft = await req(
    a.f + '/calls',
    'POST',
    {
      amount: '1000000.00',
      purpose: 'operating',
      asOf: '2026-11-01',
      dueDate: '2026-11-25',
    },
    a.cookie,
  );
  assert.equal(draft.status, 201, JSON.stringify(draft.body));
  let calculated = await req(
    `${a.f}/calls/${draft.body.id}/calculate`,
    'POST',
    { revision: 1 },
    a.cookie,
  );
  assert.equal(calculated.status, 201, JSON.stringify(calculated.body));
  let state = (await req('/state', 'GET', undefined, a.cookie)).body;
  let run = state.runs.find((r) => r.id === calculated.body.id);
  assert.equal(run.status, 'READY_FOR_APPROVAL', JSON.stringify(run));
  assert.equal(run.result.total, '1000000.00');
  assert.equal(run.input.call.asOf, '2026-11-01');
  assert.equal(run.input.call.dueDate, '2026-11-25');
  assert.deepEqual(
    run.result.allocations.map((a) => a.amount).sort(),
    [
      '100000.00',
      '100000.00',
      '200000.00',
      '250000.00',
      '300000.00',
      '50000.00',
    ].sort(),
  );
  assert.equal(fingerprint(run.input), run.input_hash);
  assert.equal(fingerprint(run.result), run.result_hash);
  await req(
    a.f + '/records/financial',
    'POST',
    {
      data: {
        category: 'EXPENSE',
        amount: '20.00',
        currency: 'USD',
        date: '2026-10-31',
        reference: 'Test expense',
      },
    },
    a.cookie,
  );
  assert.equal(
    (
      await req(
        `${a.f}/runs/${run.id}/approve`,
        'POST',
        {
          inputHash: run.input_hash,
          resultHash: run.result_hash,
          reason: 'Reviewed',
        },
        a.cookie,
      )
    ).status,
    409,
  );
  calculated = await req(
    `${a.f}/calls/${draft.body.id}/calculate`,
    'POST',
    { revision: 1 },
    a.cookie,
  );
  state = (await req('/state', 'GET', undefined, a.cookie)).body;
  run = state.runs.find((r) => r.id === calculated.body.id);
  const approved = await req(
    `${a.f}/runs/${run.id}/approve`,
    'POST',
    {
      inputHash: run.input_hash,
      resultHash: run.result_hash,
      reason: 'Reviewed all six allocations',
    },
    a.cookie,
  );
  assert.equal(approved.status, 201, JSON.stringify(approved.body));
  const exported = await req(
    `${a.f}/runs/${run.id}/export`,
    'POST',
    {},
    a.cookie,
  );
  assert.equal(exported.status, 201, JSON.stringify(exported.body));
  assert.equal(exported.body.artifacts.length, 6);
  const pdf = await req(
    `${a.f}/artifacts/${exported.body.artifacts[0].id}`,
    'GET',
    undefined,
    a.cookie,
  );
  assert.equal(pdf.status, 200);
  assert.ok(pdf.body.startsWith('%PDF'));
  assert.equal(
    (
      await req(
        `${a.f}/artifacts/${exported.body.receiptId}`,
        'GET',
        undefined,
        b.cookie,
      )
    ).status,
    404,
  );
});
test('an investor excuse redistributes only under a reviewed rule; short notice blocks approval', async () => {
  const draft = await req(
    b.f + '/calls',
    'POST',
    {
      amount: '1000000.00',
      purpose: 'acquisition',
      asOf: '2026-11-01',
      dueDate: '2026-11-25',
    },
    b.cookie,
  );
  const calc = await req(
    `${b.f}/calls/${draft.body.id}/calculate`,
    'POST',
    { revision: 1 },
    b.cookie,
  );
  const state = (await req('/state', 'GET', undefined, b.cookie)).body;
  const run = state.runs.find((r) => r.id === calc.body.id);
  assert.equal(run.status, 'READY_FOR_APPROVAL');
  assert.equal(
    run.result.allocations.find((a) => a.name === 'Cedar Foundation').amount,
    '0.00',
  );
  assert.equal(
    run.result.allocations.find((a) => a.name === 'Alder Family Office').amount,
    '375000.00',
  );
  const short = await req(
    b.f + '/calls',
    'POST',
    {
      amount: '100.00',
      purpose: 'operating',
      asOf: '2026-11-01',
      dueDate: '2026-11-02',
    },
    b.cookie,
  );
  const blocked = await req(
    `${b.f}/calls/${short.body.id}/calculate`,
    'POST',
    { revision: 1 },
    b.cookie,
  );
  assert.equal(blocked.body.status, 'BLOCKED');
});
test('unknown questions abstain and sourced answers retain document versions', async () => {
  const historical = await req(
    a.f + '/questions',
    'POST',
    { question: 'What is the capital call notice period?', asOf: '2025-01-01' },
    a.cookie,
  );
  assert.equal(historical.body.answer.status, 'INSUFFICIENT_EVIDENCE');
  const unknown = await req(
    a.f + '/questions',
    'POST',
    { question: 'What is the weather in Tokyo?', asOf: '2026-11-01' },
    a.cookie,
  );
  assert.equal(unknown.body.answer.status, 'INSUFFICIENT_EVIDENCE');
  const known = await req(
    a.f + '/questions',
    'POST',
    { question: 'What is the capital call notice period?', asOf: '2026-11-01' },
    a.cookie,
  );
  assert.ok(known.body.answer.citations.length);
  assert.ok(
    known.body.answer.citations.every(
      (c) => c.version === 1 && c.locator.page === 1,
    ),
  );
});
test('reviewed notice answers distinguish the fund rule from investor exceptions', async () => {
  const result = await req(
    a.f + '/questions',
    'POST',
    {
      question:
        'What are the capital call notice requirements including investor exceptions?',
      asOf: '2026-11-01',
    },
    a.cookie,
  );
  assert.equal(result.body.answer.mode, 'deterministic_rulebook');
  assert.match(result.body.answer.text, /Fund rule: 10 calendar days/);
  assert.match(result.body.answer.text, /Birch Endowment: 15 calendar days/);
  assert.match(
    result.body.answer.text,
    /Cedar Foundation: excused purposes are acquisition/,
  );
  const scoped = await req(
    a.f + '/questions',
    'POST',
    { question: 'What is Birch notice period?', asOf: '2026-11-01' },
    a.cookie,
  );
  assert.match(scoped.body.answer.text, /Birch Endowment: 15 calendar days/);
  assert.doesNotMatch(scoped.body.answer.text, /Fund rule: 10/);
});
test('local AI outputs validate citations and fail visibly back to source evidence', async () => {
  const originalFetch = global.fetch,
    originalModel = process.env.OLLAMA_MODEL;
  process.env.OLLAMA_MODEL = 'fixture-local';
  try {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        message: {
          content: JSON.stringify({
            answer: 'Untrusted result',
            sourceIds: ['invented-source'],
            insufficientEvidence: false,
          }),
        },
      }),
    });
    const bad = await req(
      a.f + '/questions',
      'POST',
      { question: 'Capital call permitted purposes?', asOf: '2026-11-01' },
      a.cookie,
    );
    assert.equal(bad.body.answer.mode, 'evidence_search');
    assert.match(bad.body.answer.notice, /citations failed validation/);
    global.fetch = async (url, options) => {
      assert.equal(url, 'http://127.0.0.1:11434/api/chat');
      const payload = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              answer: 'Review the cited notice provision.',
              sourceIds: [payload.format.properties.sourceIds.items.enum[0]],
              insufficientEvidence: false,
            }),
          },
        }),
      };
    };
    const valid = await req(
      a.f + '/questions',
      'POST',
      { question: 'Capital call permitted purposes?', asOf: '2026-11-01' },
      a.cookie,
    );
    assert.equal(valid.body.answer.mode, 'local_ai_draft');
    assert.equal(valid.body.answer.requiresReview, true);
    assert.equal(valid.body.answer.modelCitedSourceIds.length, 1);
    assert.ok(
      valid.body.answer.citations.some(
        (c) => c.id === valid.body.answer.modelCitedSourceIds[0],
      ),
    );
  } finally {
    global.fetch = originalFetch;
    if (originalModel === undefined) delete process.env.OLLAMA_MODEL;
    else process.env.OLLAMA_MODEL = originalModel;
  }
});
test('PDF text, local scanned OCR and spreadsheet locators are extracted without a cloud API', async () => {
  const pdf = await simplePdf('Source', ['Preferred return is 8% annually.']);
  const result = await parseDocument(pdf, 'source.pdf');
  assert.match(result.sources[0].text, /8%/);
  assert.equal(result.sources[0].locator.page, 1);
  const canvas = createCanvas(1200, 300);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 1200, 300);
  ctx.fillStyle = 'black';
  ctx.font = '40px sans-serif';
  ctx.fillText('Preferred return is 8 percent annually.', 40, 140);
  const scanned = await PDFDocument.create();
  const png = await scanned.embedPng(canvas.toBuffer('image/png'));
  const page = scanned.addPage([600, 150]);
  page.drawImage(png, { x: 0, y: 0, width: 600, height: 150 });
  const ocr = await parseDocument(
    Buffer.from(await scanned.save()),
    'scan.pdf',
  );
  assert.match(ocr.sources[0].text, /Preferred return/i);
  assert.equal(ocr.sources[0].locator.method, 'local_tesseract_english');
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Investor', 'Commitment'],
      ['Alder', '3000000'],
    ]),
    'Investors',
  );
  const sheet = await parseDocument(
    XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
    'sheet.xlsx',
  );
  assert.equal(sheet.sources[1].locator.cells, 'A2:B2');
});
test('audit history cannot be updated, including by the database owner', async () => {
  await assert.rejects(
    () =>
      db.query("UPDATE sb_events SET action='TAMPERED' WHERE org_id=$1", [
        a.user.orgId,
      ]),
    /append only/,
  );
});
test('DOCX is converted to a stable PDF rendition with page citations', async () => {
  const JSZip = require('jszip');
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    'word/document.xml',
    '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Preferred return is 8% annually. Synthetic DOCX evidence.</w:t></w:r></w:p></w:body></w:document>',
  );
  const result = await parseDocument(
    await zip.generateAsync({ type: 'nodebuffer' }),
    'source.docx',
  );
  assert.ok(result.rendition);
  assert.match(result.sources[0].text, /8%/);
  assert.equal(result.sources[0].locator.page, 1);
  assert.equal(result.sources[0].locator.rendition, true);
});
test('document upload worker retains sources, proposes terms, and requires review', async () => {
  const boundary = 'test' + randomUUID();
  const bytes = await simplePdf('Uploaded fixture', [
    'Preferred return is 9% annually.',
  ]);
  const upload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="documentType"\r\n\r\nlpa\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="uploaded.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
    ),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const response = await req(
    b.f + '/documents',
    'POST',
    upload,
    b.cookie,
    randomUUID(),
    { 'content-type': `multipart/form-data; boundary=${boundary}` },
  );
  assert.equal(response.status, 201, JSON.stringify(response.body));
  await app.get(SandboxWorker).tick();
  let state = (await req('/state', 'GET', undefined, b.cookie)).body;
  const doc = state.documents.find((d) => d.id === response.body.id);
  assert.equal(doc.status, 'NEEDS_REVIEW', doc.error);
  const fact = state.facts.find(
    (f) =>
      f.document_id === doc.id &&
      f.taxonomy_key === 'economics.preferred_return_rate' &&
      f.value !== null,
  );
  assert.equal(fact.value, 0.09);
  assert.equal(fact.state, 'UNREVIEWED');
  const published = await req(
    b.f + '/rules',
    'POST',
    {
      key: fact.taxonomy_key,
      value: 0.09,
      sourceId: fact.source_id,
      factId: fact.id,
      effectiveFrom: '2026-01-01',
      baseVersion: 1,
      reason: 'Synthetic amendment replaces baseline preferred return',
      replaceConfirmed: true,
    },
    b.cookie,
  );
  assert.equal(published.status, 201, JSON.stringify(published.body));
  const conflict = await req(
    b.f + '/rules',
    'POST',
    {
      key: fact.taxonomy_key,
      value: 0.1,
      sourceId: fact.source_id,
      effectiveFrom: '2026-01-01',
      baseVersion: 2,
      reason: 'Unresolved disagreement',
    },
    b.cookie,
  );
  assert.equal(conflict.status, 409);
  const review = await req(
    `${b.f}/documents/${doc.id}/review`,
    'POST',
    {
      reason:
        'Confirmed preferred return; remaining suggestions rejected after source review',
    },
    b.cookie,
  );
  assert.equal(review.status, 201);
  state = (await req('/state', 'GET', undefined, b.cookie)).body;
  assert.equal(state.rulebook.version, 2);
  assert.equal(state.documents.find((d) => d.id === doc.id).status, 'READY');
});
test('rejection, revision and cancellation preserve history and prevent old approvals', async () => {
  const draft = await req(
    b.f + '/calls',
    'POST',
    {
      amount: '100.01',
      purpose: 'operating',
      asOf: '2026-11-01',
      dueDate: '2026-11-25',
    },
    b.cookie,
  );
  const calculated = await req(
    `${b.f}/calls/${draft.body.id}/calculate`,
    'POST',
    { revision: 1 },
    b.cookie,
  );
  let state = (await req('/state', 'GET', undefined, b.cookie)).body;
  const run = state.runs.find((r) => r.id === calculated.body.id);
  assert.equal(
    run.result.allocations.reduce(
      (sum, a) => sum + Math.round(Number(a.amount) * 100),
      0,
    ),
    10001,
  );
  const rejection = await req(
    `${b.f}/runs/${run.id}/reject`,
    'POST',
    {
      inputHash: run.input_hash,
      resultHash: run.result_hash,
      reason: 'Revise purpose after review',
    },
    b.cookie,
  );
  assert.equal(rejection.status, 201, JSON.stringify(rejection.body));
  const revised = await req(
    `${b.f}/calls/${draft.body.id}`,
    'PUT',
    {
      revision: 2,
      amount: '200.01',
      purpose: 'acquisition',
      asOf: '2026-11-01',
      dueDate: '2026-11-25',
      reason: 'New acquisition purpose',
    },
    b.cookie,
  );
  assert.equal(revised.status, 200);
  assert.equal(
    (
      await req(
        `${b.f}/calls/${draft.body.id}`,
        'PUT',
        { revision: 2, cancel: true, reason: 'Stale revision' },
        b.cookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await req(
        `${b.f}/calls/${draft.body.id}`,
        'PUT',
        { revision: 3, cancel: true, reason: 'No longer required' },
        b.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await req(
        `${b.f}/calls/${draft.body.id}/calculate`,
        'POST',
        { revision: 4 },
        b.cookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await req(
        `${b.f}/runs/${run.id}/approve`,
        'POST',
        {
          inputHash: run.input_hash,
          resultHash: run.result_hash,
          reason: 'Attempt old approval',
        },
        b.cookie,
      )
    ).status,
    409,
  );
  state = (await req('/state', 'GET', undefined, b.cookie)).body;
  assert.ok(
    state.approvals.some(
      (a) => a.run_id === run.id && a.decision === 'REJECTED',
    ),
  );
});
test('concurrent approvals cannot over-reserve commitments and historical dates fail closed', async () => {
  const drafts = await Promise.all(
    ['5000000.00', '5000000.00'].map((amount) =>
      req(
        b.f + '/calls',
        'POST',
        {
          amount,
          purpose: 'operating',
          asOf: '2026-11-01',
          dueDate: '2026-11-25',
        },
        b.cookie,
      ),
    ),
  );
  const calculated = await Promise.all(
    drafts.map((d) =>
      req(
        `${b.f}/calls/${d.body.id}/calculate`,
        'POST',
        { revision: 1 },
        b.cookie,
      ),
    ),
  );
  const state = (await req('/state', 'GET', undefined, b.cookie)).body;
  const runs = calculated.map((c) =>
    state.runs.find((r) => r.id === c.body.id),
  );
  assert.ok(runs.every((r) => r.status === 'READY_FOR_APPROVAL'));
  const approvals = await Promise.all(
    runs.map((r) =>
      req(
        `${b.f}/runs/${r.id}/approve`,
        'POST',
        {
          inputHash: r.input_hash,
          resultHash: r.result_hash,
          reason: 'Concurrent capacity test',
        },
        b.cookie,
      ),
    ),
  );
  assert.deepEqual(approvals.map((r) => r.status).sort(), [201, 409]);
  const draft = await req(
    b.f + '/calls',
    'POST',
    {
      amount: '1.00',
      purpose: 'operating',
      asOf: '2025-12-01',
      dueDate: '2026-01-25',
    },
    b.cookie,
  );
  const calc = await req(
    `${b.f}/calls/${draft.body.id}/calculate`,
    'POST',
    { revision: 1 },
    b.cookie,
  );
  const run = (await req('/state', 'GET', undefined, b.cookie)).body.runs.find(
    (r) => r.id === calc.body.id,
  );
  assert.ok(
    run.result.checks.some(
      (c) => c.code === 'FINANCIAL_AS_OF' && c.result === 'FAIL',
    ),
  );
});
test('record answers use exact decimal sums and reversible postings retain evidence', async () => {
  const question = await req(
    b.f + '/questions',
    'POST',
    { question: 'What are the total contributions?', asOf: '2026-11-01' },
    b.cookie,
  );
  assert.equal(question.body.answer.calculation.total, '2000000.00');
  assert.equal(question.body.answer.mode, 'deterministic_records');
  assert.equal(
    fingerprint(question.body.answer.calculation.inputs),
    question.body.answer.calculation.inputHash,
  );
  const expense = await req(
    b.f + '/records/financial',
    'POST',
    {
      data: {
        category: 'EXPENSE',
        amount: '0.01',
        currency: 'USD',
        date: '2026-11-01',
        reference: 'Rounding fixture',
      },
    },
    b.cookie,
  );
  assert.equal(
    (
      await req(
        `${b.f}/records/${expense.body.id}/reverse`,
        'POST',
        { reason: 'Correct posting' },
        b.cookie,
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await req(
        `${b.f}/records/${expense.body.id}/reverse`,
        'POST',
        { reason: 'Duplicate reversal' },
        b.cookie,
      )
    ).status,
    409,
  );
  await assert.rejects(
    () =>
      db.query('UPDATE sb_records SET amount=0 WHERE id=$1', [expense.body.id]),
    /immutable/,
  );
  const run = (await req('/state', 'GET', undefined, b.cookie)).body.runs[0];
  await assert.rejects(
    () =>
      db.query("UPDATE sb_runs SET input='{}'::jsonb WHERE id=$1", [run.id]),
    /immutable/,
  );
});
test('scenario totals reconcile and unsupported prior distributions are blocked', async () => {
  const first = await req(
    a.f + '/scenarios',
    'POST',
    { amount: '3000000.00', asOf: '2026-11-01' },
    a.cookie,
  );
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const r = first.body.result;
  assert.equal(
    [r.returnOfCapital, r.preferredReturn, r.lpResidual, r.gpResidual].reduce(
      (n, v) => n + Math.round(Number(v) * 100),
      0,
    ),
    300000000,
  );
  const posting = await req(
    a.f + '/records/financial',
    'POST',
    {
      data: {
        category: 'DISTRIBUTION',
        amount: '1.00',
        currency: 'USD',
        date: '2026-11-01',
        reference: 'Unsupported prior distribution',
      },
    },
    a.cookie,
  );
  assert.equal(posting.status, 201);
  assert.equal(
    (
      await req(
        a.f + '/scenarios',
        'POST',
        { amount: '100.00', asOf: '2026-11-01' },
        a.cookie,
      )
    ).status,
    422,
  );
});
test('expired final worker leases become failed instead of remaining stuck', async () => {
  const doc = randomUUID(),
    job = randomUUID(),
    bytes = await simplePdf('Stale fixture', [
      'Synthetic worker retry fixture.',
    ]);
  await db.query(
    "INSERT INTO sb_documents(id,org_id,fund_id,logical_id,version,filename,mime,document_type,content,sha256,status) VALUES($1,$2,$3,$1,1,'stale.pdf','application/pdf','other',$4,$5,'PROCESSING')",
    [doc, b.user.orgId, b.state.fund.id, bytes, 'b'.repeat(64)],
  );
  await db.query(
    "INSERT INTO sb_jobs(id,org_id,fund_id,document_id,generation,status,attempts,lease_until) VALUES($1,$2,$3,$4,1,'RUNNING',3,now()-interval '1 minute')",
    [job, b.user.orgId, b.state.fund.id, doc],
  );
  await app.get(SandboxWorker).tick();
  const state = (await req('/state', 'GET', undefined, b.cookie)).body;
  assert.equal(state.jobs.find((j) => j.id === job).status, 'FAILED');
  assert.equal(state.documents.find((d) => d.id === doc).status, 'FAILED');
});
test('reset archives private uploads, cancels old jobs and cannot affect another sandbox', async () => {
  const originalB = (await req('/state', 'GET', undefined, b.cookie)).body;
  const docId = randomUUID();
  const bytes = await simplePdf('Private fixture', ['Private test document.']);
  await db.query(
    "INSERT INTO sb_documents(id,org_id,fund_id,logical_id,version,filename,mime,document_type,content,sha256) VALUES($1,$2,$3,$1,1,'private.pdf','application/pdf','other',$4,$5)",
    [docId, a.user.orgId, a.state.fund.id, bytes, 'a'.repeat(64)],
  );
  const reset = await req(
    '/reset',
    'POST',
    { generation: 1, confirmation: 'RESET' },
    a.cookie,
  );
  assert.equal(reset.status, 201, JSON.stringify(reset.body));
  const current = (await req('/state', 'GET', undefined, a.cookie)).body;
  assert.equal(current.generation, 2);
  assert.notEqual(current.fund.id, a.state.fund.id);
  const archive = await req('/archive', 'GET', undefined, a.cookie);
  assert.ok(archive.body.some((d) => d.id === docId));
  assert.equal(
    (await req(`${a.f}/documents/${docId}/content`, 'GET', undefined, a.cookie))
      .status,
    200,
  );
  assert.deepEqual(
    (await req('/state', 'GET', undefined, b.cookie)).body.calls,
    originalB.calls,
  );
  assert.ok(current.events.some((e) => e.action === 'CALL_APPROVED'));
});
test('accounts, private data and audit history survive a database restart', async () => {
  const before = (await req('/state', 'GET', undefined, b.cookie)).body;
  await app.close();
  app = await createSandboxApp();
  await app.init();
  server = app.getHttpAdapter().getInstance();
  await server.ready();
  db = app.get(SandboxDatabase);
  const state = (await req('/state', 'GET', undefined, b.cookie)).body;
  assert.equal(state.fund.id, before.fund.id);
  assert.deepEqual(state.approvals, before.approvals);
  assert.deepEqual(state.records, before.records);
});
