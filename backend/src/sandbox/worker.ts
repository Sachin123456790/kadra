import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { SandboxDatabase } from './database';
import { parseDocument } from './parser';
import { suggestTerms, TAXONOMY_VERSION } from './taxonomy';
import { id, Queryable } from './types';

@Injectable()
export class SandboxWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private pending?: Promise<void>;
  constructor(private readonly db: SandboxDatabase) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      if (!this.pending)
        this.pending = this.tick()
          .catch(() => {})
          .finally(() => {
            this.pending = undefined;
          });
    }, 1500);
    this.timer.unref();
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.pending;
  }
  private async audit(
    tx: Queryable,
    job: any,
    action: string,
    extra: any = {},
  ) {
    await tx.query(
      `INSERT INTO sb_events(org_id,fund_id,actor_id,action,payload)
      SELECT $1,$2,actor_id,$3,$4::jsonb FROM sb_events WHERE org_id=$1 AND action='DOCUMENT_UPLOADED' AND payload->>'id'=$5 ORDER BY id LIMIT 1`,
      [
        job.org_id,
        job.fund_id,
        action,
        JSON.stringify({
          jobId: job.id,
          documentId: job.document_id,
          attempt: job.attempts,
          actorType: 'background_worker',
          ...extra,
        }),
        job.document_id,
      ],
    );
  }
  async tick() {
    const job = await this.db.transaction(async (tx) => {
      const exhausted = (
        await tx.query(
          "UPDATE sb_jobs SET status='FAILED',lease_until=null,error='Processing lease expired after three attempts.' WHERE status='RUNNING' AND lease_until<now() AND attempts>=3 RETURNING *",
        )
      ).rows;
      for (const row of exhausted) {
        await tx.query(
          "UPDATE sb_documents SET status='FAILED',error=$1 WHERE id=$2 AND org_id=$3",
          [row.error, row.document_id, row.org_id],
        );
        await this.audit(tx, row, 'DOCUMENT_PROCESSING_FAILED', {
          reason: row.error,
        });
      }
      const row = (
        await tx.query(`SELECT j.* FROM sb_jobs j JOIN sb_organizations o ON o.id=j.org_id AND o.generation=j.generation
        WHERE ((j.status='QUEUED' AND j.available_at<=now()) OR (j.status='RUNNING' AND j.lease_until<now())) AND j.attempts<3
        ORDER BY j.created_at LIMIT 1 FOR UPDATE OF j SKIP LOCKED`)
      ).rows[0];
      if (!row) return null;
      await tx.query(
        "UPDATE sb_jobs SET status='RUNNING',attempts=attempts+1,lease_until=now()+interval '5 minutes' WHERE id=$1",
        [row.id],
      );
      await tx.query(
        "UPDATE sb_documents SET status='PROCESSING',error=null WHERE id=$1 AND org_id=$2",
        [row.document_id, row.org_id],
      );
      await this.audit(
        tx,
        { ...row, attempts: row.attempts + 1 },
        'DOCUMENT_PROCESSING_STARTED',
      );
      return { ...row, attempts: row.attempts + 1 };
    });
    if (!job) return;
    try {
      const document = (
        await this.db.query(
          'SELECT content,filename FROM sb_documents WHERE org_id=$1 AND id=$2',
          [job.org_id, job.document_id],
        )
      ).rows[0];
      const parsed = await parseDocument(
        Buffer.from(document.content),
        document.filename,
        async () => {
          await this.db.query(
            "UPDATE sb_jobs SET lease_until=now()+interval '5 minutes' WHERE id=$1 AND attempts=$2 AND status='RUNNING'",
            [job.id, job.attempts],
          );
        },
      );
      await this.db.transaction(async (tx) => {
        const org = (
          await tx.query(
            'SELECT generation FROM sb_organizations WHERE id=$1 FOR UPDATE',
            [job.org_id],
          )
        ).rows[0];
        const current = (
          await tx.query(
            'SELECT status,attempts FROM sb_jobs WHERE id=$1 FOR UPDATE',
            [job.id],
          )
        ).rows[0];
        if (
          org.generation !== job.generation ||
          current.attempts !== job.attempts ||
          current.status !== 'RUNNING'
        )
          return;
        const sources = parsed.sources.map((s) => ({ ...s, id: id() }));
        for (const source of sources)
          await tx.query(
            'INSERT INTO sb_sources(id,org_id,fund_id,document_id,locator,text) VALUES($1,$2,$3,$4,$5::jsonb,$6)',
            [
              source.id,
              job.org_id,
              job.fund_id,
              job.document_id,
              JSON.stringify(source.locator),
              source.text,
            ],
          );
        for (const fact of suggestTerms(sources))
          await tx.query(
            `INSERT INTO sb_facts(id,org_id,fund_id,document_id,taxonomy_key,value,source_id,state,taxonomy_version,extraction)
          VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10::jsonb)`,
            [
              id(),
              job.org_id,
              job.fund_id,
              job.document_id,
              fact.key,
              JSON.stringify(fact.value),
              fact.sourceId,
              fact.state,
              TAXONOMY_VERSION,
              JSON.stringify({
                provider: 'local_pattern_suggestions',
                jobId: job.id,
                attempt: job.attempts,
                requiresHumanReview: true,
              }),
            ],
          );
        await tx.query(
          "UPDATE sb_documents SET status='NEEDS_REVIEW',rendition=$1 WHERE id=$2 AND org_id=$3",
          [parsed.rendition || null, job.document_id, job.org_id],
        );
        await tx.query(
          "UPDATE sb_jobs SET status='COMPLETED',lease_until=null,error=null WHERE id=$1",
          [job.id],
        );
        await this.audit(tx, job, 'DOCUMENT_PROCESSING_COMPLETED', {
          sourceCount: sources.length,
          taxonomyVersion: TAXONOMY_VERSION,
        });
      });
    } catch (error: any) {
      const message =
        error?.getResponse?.()?.message ||
        'Processing failed. Check the file and worker configuration, then retry.';
      await this.db.transaction(async (tx) => {
        const org = (
          await tx.query(
            'SELECT generation FROM sb_organizations WHERE id=$1 FOR UPDATE',
            [job.org_id],
          )
        ).rows[0];
        if (org.generation !== job.generation) return;
        const changed = await tx.query(
          "UPDATE sb_jobs SET status='FAILED',lease_until=null,error=$1 WHERE id=$2 AND attempts=$3 AND status='RUNNING' RETURNING id",
          [message, job.id, job.attempts],
        );
        if (!changed.rows.length) return;
        await tx.query(
          "UPDATE sb_documents SET status='FAILED',error=$1 WHERE id=$2 AND org_id=$3",
          [message, job.document_id, job.org_id],
        );
        await this.audit(tx, job, 'DOCUMENT_PROCESSING_FAILED', {
          reason: message,
        });
      });
    }
  }
}
