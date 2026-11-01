import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { SandboxAuth } from './auth';
import { SandboxService } from './service';
import { Actor, allow, fail, id, text } from './types';
import { event } from './seed';

@Controller('sandbox')
export class SandboxController {
  constructor(
    private readonly auth: SandboxAuth,
    private readonly service: SandboxService,
  ) {}
  private token(req: FastifyRequest) {
    return (
      req.headers.cookie
        ?.split(';')
        .map((p) => p.trim())
        .find((p) => p.startsWith('angainor_sandbox='))
        ?.slice('angainor_sandbox='.length) || ''
    );
  }
  private async use<T>(req: FastifyRequest, fn: (actor: Actor) => Promise<T>) {
    const actor = await this.auth.actor(this.token(req));
    return this.service.db.as(actor.orgId, () => fn(actor));
  }
  private async mutation(
    req: FastifyRequest,
    operation: string,
    body: any,
    fn: (actor: Actor, tx: any) => Promise<any>,
  ) {
    return this.use(req, (actor) =>
      this.service.mutate(
        actor,
        operation,
        String(req.headers['idempotency-key'] || ''),
        body,
        (tx) => fn(actor, tx),
      ),
    );
  }
  private cookie(reply: FastifyReply, token: string, remove = false) {
    reply.header(
      'Set-Cookie',
      `angainor_sandbox=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${remove ? 0 : 43200}${process.env.SANDBOX_SECURE_COOKIE === 'true' ? '; Secure' : ''}`,
    );
  }
  @Post('auth/register') async register(
    @Body() body: any,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.register(body);
    this.cookie(reply, result.token);
    return result.user;
  }
  @Post('auth/login') async login(
    @Body() body: any,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.login(body);
    this.cookie(reply, result.token);
    return result.user;
  }
  @Get('auth/me') me(@Req() req: FastifyRequest) {
    return this.auth.actor(this.token(req));
  }
  @Post('auth/logout') async logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.auth.logout(this.token(req));
    this.cookie(reply, '', true);
    return { ok: true };
  }
  @Get('state') state(
    @Req() req: FastifyRequest,
    @Query('fundId') fundId?: string,
  ) {
    return this.use(req, (a) => this.service.state(a, fundId));
  }
  @Post('funds') fund(@Req() req: FastifyRequest, @Body() body: any) {
    return this.mutation(req, 'create-fund', body, (a, tx) =>
      this.service.createFund(tx, a, body),
    );
  }
  @Post('reset') reset(@Req() req: FastifyRequest, @Body() body: any) {
    return this.mutation(req, 'reset', body, (a, tx) =>
      this.service.reset(tx, a, body),
    );
  }
  @Get('archive') archive(@Req() req: FastifyRequest) {
    return this.use(
      req,
      async (a) =>
        (
          await this.service.db.query(
            `SELECT d.id,d.fund_id,d.filename,d.version,d.status,d.created_at FROM sb_documents d JOIN sb_funds f ON f.id=d.fund_id AND f.org_id=d.org_id WHERE d.org_id=$1 AND f.generation<>$2 AND d.synthetic=false ORDER BY d.created_at DESC`,
            [a.orgId, a.generation],
          )
        ).rows,
    );
  }
  @Post('funds/:fundId/records/:kind') record(
    @Req() req: FastifyRequest,
    @Param() p: any,
    @Body() body: any,
  ) {
    return this.mutation(
      req,
      `create-record:${p.fundId}:${p.kind}`,
      body,
      (a, tx) => this.service.saveRecord(tx, a, p.fundId, p.kind, body),
    );
  }
  @Put('funds/:fundId/records/:kind/:id') updateRecord(
    @Req() req: FastifyRequest,
    @Param() p: any,
    @Body() body: any,
  ) {
    return this.mutation(
      req,
      `update-record:${p.fundId}:${p.id}`,
      body,
      (a, tx) => this.service.saveRecord(tx, a, p.fundId, p.kind, body, p.id),
    );
  }
  @Post('funds/:fundId/records/:id/reverse') reverse(
    @Req() req: FastifyRequest,
    @Param() p: any,
    @Body() body: any,
  ) {
    return this.mutation(req, `reverse:${p.fundId}:${p.id}`, body, (a, tx) =>
      this.service.reverse(tx, a, p.fundId, p.id, body),
    );
  }
  @Post('funds/:fundId/documents') async upload(
    @Req() req: FastifyRequest,
    @Param('fundId') fundId: string,
  ) {
    // Authenticate before accepting file bytes. Fastify applies the bounded stream limit.
    const actor = await this.auth.actor(this.token(req));
    allow(actor, ['editor']);
    const part = await req.file();
    if (!part) fail(400, 'FILE_REQUIRED', 'Choose a file.');
    const bytes = await part.toBuffer();
    const fields: any = {};
    for (const [key, value] of Object.entries(part.fields))
      if (value && !Array.isArray(value) && value.type === 'field')
        fields[key] = value.value;
    return this.service.db.as(actor.orgId, () =>
      this.service.mutate(
        actor,
        `upload:${fundId}`,
        String(req.headers['idempotency-key'] || ''),
        {
          filename: part.filename,
          fields,
          bytesHash: require('node:crypto')
            .createHash('sha256')
            .update(bytes)
            .digest('hex'),
        },
        (tx) =>
          this.service.upload(tx, actor, fundId, bytes, part.filename, fields),
      ),
    );
  }
  @Get('funds/:fundId/sources') sources(
    @Req() req: FastifyRequest,
    @Param('fundId') fundId: string,
    @Query('documentId') documentId?: string,
  ) {
    return this.use(req, (a) => this.service.sources(a, fundId, documentId));
  }
  @Get('funds/:fundId/documents/:id/content') async content(
    @Req() req: FastifyRequest,
    @Param() p: any,
    @Res() reply: FastifyReply,
    @Query('original') original?: string,
  ) {
    const doc = await this.use(req, (a) =>
      this.service.document(a, p.fundId, p.id),
    );
    const rendition = doc.rendition && original !== 'true';
    reply
      .header('Content-Type', rendition ? 'application/pdf' : doc.mime)
      .header(
        'Content-Disposition',
        `${rendition || doc.mime === 'application/pdf' ? 'inline' : 'attachment'}; filename="${doc.filename.replace(/[^a-zA-Z0-9._ -]/g, '_')}${rendition ? '.pdf' : ''}"`,
      )
      .header('Cache-Control', 'no-store')
      .send(Buffer.from(rendition ? doc.rendition : doc.content));
  }
  @Post('funds/:fundId/documents/:id/review') review(
    @Req() req: FastifyRequest,
    @Param() p: any,
    @Body() body: any,
  ) {
    return this.mutation(req, `review:${p.fundId}:${p.id}`, body, (a, tx) =>
      this.service.reviewDocument(tx, a, p.fundId, p.id, body),
    );
  }
  @Post('funds/:fundId/jobs/:id/retry') retry(
    @Req() req: FastifyRequest,
    @Param() p: any,
    @Body() body: any,
  ) {
    return this.mutation(
      req,
      `retry:${p.fundId}:${p.id}`,
      body,
      async (a, tx) => {
        allow(a, ['editor']);
        await this.service.fund(tx, a, p.fundId);
        const row = (
          await tx.query(
            "UPDATE sb_jobs SET status='QUEUED',available_at=now(),error=null WHERE org_id=$1 AND fund_id=$2 AND id=$3 AND generation=$4 AND status='FAILED' AND attempts<3 RETURNING document_id",
            [a.orgId, p.fundId, p.id, a.generation],
          )
        ).rows[0];
        if (!row)
          fail(
            422,
            'RETRY_UNAVAILABLE',
            'Only a failed current-generation job with fewer than three attempts can be retried.',
          );
        await tx.query(
          "UPDATE sb_documents SET status='QUEUED',error=null WHERE org_id=$1 AND id=$2",
          [a.orgId, row.document_id],
        );
        await event(tx, a, 'JOB_RETRY_REQUESTED', { id: p.id }, p.fundId);
        return { status: 'QUEUED' };
      },
    );
  }
  @Post('funds/:fundId/rules') rule(
    @Req() req: FastifyRequest,
    @Param('fundId') fundId: string,
    @Body() body: any,
  ) {
    return this.mutation(req, `rule:${fundId}`, body, (a, tx) =>
      this.service.publishRule(tx, a, fundId, body),
    );
  }
  @Post('funds/:fundId/questions') question(
    @Req() req: FastifyRequest,
    @Param('fundId') fundId: string,
    @Body() body: any,
  ) {
    return this.use(req, (a) => this.service.answer(a, fundId, body));
  }
  @Post('funds/:fundId/calls') call(
    @Req() req: FastifyRequest,
    @Param('fundId') fundId: string,
    @Body() body: any,
  ) {
    return this.mutation(req, `call:${fundId}`, body, (a, tx) =>
      this.service.createCall(tx, a, fundId, body),
    );
  }
  @Put('funds/:fundId/calls/:id') updateCall(
    @Req() req: FastifyRequest,
    @Param() p: any,
    @Body() body: any,
  ) {
    return this.mutation(
      req,
      `update-call:${p.fundId}:${p.id}`,
      body,
      (a, tx) => this.service.updateCall(tx, a, p.fundId, p.id, body),
    );
  }
  @Post('funds/:fundId/calls/:id/calculate') calculate(
    @Req() req: FastifyRequest,
    @Param() p: any,
    @Body() body: any,
  ) {
    return this.mutation(req, `calculate:${p.fundId}:${p.id}`, body, (a, tx) =>
      this.service.calculate(tx, a, p.fundId, p.id, body),
    );
  }
  @Post('funds/:fundId/runs/:id/approve') approve(
    @Req() req: FastifyRequest,
    @Param() p: any,
    @Body() body: any,
  ) {
    return this.mutation(req, `approve:${p.fundId}:${p.id}`, body, (a, tx) =>
      this.service.approve(tx, a, p.fundId, p.id, body),
    );
  }
  @Post('funds/:fundId/runs/:id/reject') reject(
    @Req() req: FastifyRequest,
    @Param() p: any,
    @Body() body: any,
  ) {
    return this.mutation(req, `reject:${p.fundId}:${p.id}`, body, (a, tx) =>
      this.service.reject(tx, a, p.fundId, p.id, body),
    );
  }
  @Post('funds/:fundId/runs/:id/export') export(
    @Req() req: FastifyRequest,
    @Param() p: any,
    @Body() body: any,
  ) {
    return this.mutation(req, `export:${p.fundId}:${p.id}`, body, (a, tx) =>
      this.service.exportRun(tx, a, p.fundId, p.id),
    );
  }
  @Get('funds/:fundId/artifacts') artifacts(
    @Req() req: FastifyRequest,
    @Param('fundId') fundId: string,
  ) {
    return this.use(req, async (a) => {
      await this.service.fund(this.service.db, a, fundId);
      return (
        await this.service.db.query(
          'SELECT id,run_id,filename,mime,sha256 FROM sb_artifacts WHERE org_id=$1 AND fund_id=$2',
          [a.orgId, fundId],
        )
      ).rows;
    });
  }
  @Get('funds/:fundId/artifacts/:id') async artifact(
    @Req() req: FastifyRequest,
    @Param() p: any,
    @Res() reply: FastifyReply,
  ) {
    const row = await this.use(
      req,
      async (a) =>
        (
          await this.service.db.query(
            'SELECT * FROM sb_artifacts WHERE org_id=$1 AND fund_id=$2 AND id=$3',
            [a.orgId, p.fundId, p.id],
          )
        ).rows[0],
    );
    if (!row) fail(404, 'NOT_FOUND', 'Artifact not found.');
    reply
      .header('Content-Type', row.mime)
      .header('Content-Disposition', `attachment; filename="${row.filename}"`)
      .send(Buffer.from(row.content));
  }
  @Post('funds/:fundId/scenarios') scenario(
    @Req() req: FastifyRequest,
    @Param('fundId') fundId: string,
    @Body() body: any,
  ) {
    return this.mutation(req, `scenario:${fundId}`, body, (a, tx) =>
      this.service.scenario(tx, a, fundId, body),
    );
  }
  @Get('funds/:fundId/report') report(
    @Req() req: FastifyRequest,
    @Param('fundId') fundId: string,
  ) {
    return this.use(req, async (a) => {
      await this.service.fund(this.service.db, a, fundId);
      return {
        asOf: new Date().toISOString(),
        currency: 'USD',
        positions: await this.service.positions(this.service.db, a, fundId),
        basis:
          'Recorded contributions and approved outstanding calls; no bank reconciliation.',
      };
    });
  }
}
