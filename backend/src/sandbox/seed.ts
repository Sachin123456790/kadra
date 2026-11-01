import { PDFDocument, StandardFonts } from 'pdf-lib';
import { Actor, fingerprint, hash, id, Queryable, Rule } from './types';

export async function event(
  tx: Queryable,
  actor: Actor,
  action: string,
  payload: any,
  fundId?: string,
) {
  await tx.query(
    'INSERT INTO sb_events(org_id,fund_id,actor_id,action,payload) VALUES($1,$2,$3,$4,$5::jsonb)',
    [actor.orgId, fundId || null, actor.id, action, JSON.stringify(payload)],
  );
}
export async function simplePdf(title: string, lines: string[]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage(),
    y = 790;
  const draw = (line: string, size = 10) => {
    // PDF standard fonts cannot encode arbitrary Unicode. Preserve the original in receipts/JSON.
    const safe = line.replace(/[^\x20-\x7E]/g, '?');
    const words = safe.split(' ');
    let chunk = '';
    for (const word of words) {
      if (font.widthOfTextAtSize(chunk + word, size) > 480) {
        if (y < 50) {
          page = pdf.addPage();
          y = 790;
        }
        page.drawText(chunk, { x: 50, y, size, font });
        y -= 16;
        chunk = '';
      }
      chunk += word + ' ';
    }
    if (y < 50) {
      page = pdf.addPage();
      y = 790;
    }
    page.drawText(chunk, { x: 50, y, size, font });
    y -= 20;
  };
  draw(title, 15);
  lines.forEach((l) => draw(l));
  return Buffer.from(await pdf.save());
}
export async function seedFund(tx: Queryable, actor: Actor) {
  const fundId = id();
  await tx.query(
    'INSERT INTO sb_funds(id,org_id,generation,name,currency,synthetic) VALUES($1,$2,$3,$4,$5,true)',
    [
      fundId,
      actor.orgId,
      actor.generation,
      'Northstar Real Estate Fund I',
      'USD',
    ],
  );
  const investors = [
    ['Alder Family Office', '3000000.00'],
    ['Birch Endowment', '2500000.00'],
    ['Cedar Foundation', '2000000.00'],
    ['Elm Partners', '1000000.00'],
    ['Maple Trust', '1000000.00'],
    ['Northstar GP', '500000.00'],
  ].map(([name, commitment]) => ({
    id: id(),
    name,
    commitment,
    email: '',
    status: 'ACTIVE',
  }));
  for (const investor of investors) {
    await tx.query(
      'INSERT INTO sb_records(id,org_id,fund_id,kind,data,amount) VALUES($1,$2,$3,$4,$5::jsonb,$6)',
      [
        investor.id,
        actor.orgId,
        fundId,
        'investor',
        JSON.stringify(investor),
        investor.commitment,
      ],
    );
    const amount =
      ((BigInt(investor.commitment.split('.')[0]) * 20n) / 100n).toString() +
      '.00';
    await tx.query(
      'INSERT INTO sb_records(id,org_id,fund_id,kind,data,amount) VALUES($1,$2,$3,$4,$5::jsonb,$6)',
      [
        id(),
        actor.orgId,
        fundId,
        'financial',
        JSON.stringify({
          category: 'CONTRIBUTION',
          investorId: investor.id,
          date: '2026-01-01',
          amount,
          currency: 'USD',
          reference: 'Synthetic opening contribution',
          synthetic: true,
        }),
        amount,
      ],
    );
  }
  for (const [name, property] of [
    ['Northstar Residential SPV', 'Oakwood Apartments'],
    ['Northstar Industrial SPV', 'Riverside Logistics'],
  ]) {
    const spvId = id();
    await tx.query(
      'INSERT INTO sb_records(id,org_id,fund_id,kind,data) VALUES($1,$2,$3,$4,$5::jsonb)',
      [
        spvId,
        actor.orgId,
        fundId,
        'spv',
        JSON.stringify({ name, jurisdiction: 'Delaware' }),
      ],
    );
    await tx.query(
      'INSERT INTO sb_records(id,org_id,fund_id,kind,data) VALUES($1,$2,$3,$4,$5::jsonb)',
      [
        id(),
        actor.orgId,
        fundId,
        'property',
        JSON.stringify({
          name: property,
          spvId,
          address: 'Synthetic property',
          ownership: '1',
        }),
      ],
    );
  }
  const base: Array<[string, any, string?]> = [
    ['capital_calls.allocation_basis', 'commitment'],
    ['capital_calls.permitted_purposes', ['operating', 'acquisition']],
    ['capital_calls.notice_period_days', 10],
    ['capital_calls.notice_day_basis', 'calendar'],
    ['capital_calls.redistribution', 'pro_rata_eligible'],
    ['capital_calls.recallable_capital', 'none'],
    ['capital_calls.required_approvers', 'fund_approver'],
    ['economics.preferred_return_rate', 0.08],
    ['economics.preferred_return_compounding', 'simple_actual_365'],
    ['economics.residual_split_lp', 0.8],
    ['economics.residual_split_gp', 0.2],
    ['economics.gp_catchup_rate', 0],
    ['economics.return_of_capital_priority', 'all_contributed_capital_first'],
    ['operations.currency', 'USD'],
  ];
  const docs = [
    { name: 'Synthetic LPA', entries: base },
    {
      name: 'Birch side letter',
      entries: [
        ['capital_calls.notice_period_days', 15, investors[1].id],
      ] as typeof base,
    },
    {
      name: 'Cedar side letter',
      entries: [
        ['capital_calls.excused_purposes', ['acquisition'], investors[2].id],
      ] as typeof base,
    },
  ];
  const rules: Rule[] = [];
  for (const doc of docs) {
    const docId = id();
    const lines = [
      'FICTIONAL DEMO DOCUMENT. These clauses are synthetic test fixtures.',
      ...doc.entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`),
    ];
    const bytes = await simplePdf(doc.name, lines);
    await tx.query(
      `INSERT INTO sb_documents(id,org_id,fund_id,logical_id,version,filename,mime,document_type,effective_date,content,sha256,synthetic,status)
      VALUES($1,$2,$3,$1,1,$4,'application/pdf',$5,'2026-01-01',$6,$7,true,'READY')`,
      [
        docId,
        actor.orgId,
        fundId,
        doc.name + '.pdf',
        doc.name.includes('LPA') ? 'lpa' : 'side_letter',
        bytes,
        hash(bytes),
      ],
    );
    for (const [key, value, investorId] of doc.entries) {
      const sourceId = id();
      const sourceText = `${key}: ${JSON.stringify(value)}`;
      await tx.query(
        'INSERT INTO sb_sources(id,org_id,fund_id,document_id,locator,text) VALUES($1,$2,$3,$4,$5::jsonb,$6)',
        [
          sourceId,
          actor.orgId,
          fundId,
          docId,
          JSON.stringify({
            page: 1,
            section: key,
            method: 'synthetic_fixture',
            version: 1,
          }),
          sourceText,
        ],
      );
      rules.push({
        id: id(),
        key,
        value,
        investorId,
        effectiveFrom: '2026-01-01',
        sourceId,
        decision:
          'Synthetic seed baseline, not an interpretation of real documents.',
        reviewerId: actor.id,
      });
    }
  }
  await tx.query(
    'INSERT INTO sb_rulebooks(id,org_id,fund_id,version,rules,hash,actor_id) VALUES($1,$2,$3,1,$4::jsonb,$5,$6)',
    [
      id(),
      actor.orgId,
      fundId,
      JSON.stringify(rules),
      fingerprint(rules),
      actor.id,
    ],
  );
  await event(
    tx,
    actor,
    'SANDBOX_SEEDED',
    {
      generation: actor.generation,
      seedVersion: 'northstar-1',
      synthetic: true,
    },
    fundId,
  );
  return fundId;
}
