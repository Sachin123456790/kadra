import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SandboxDatabase } from './database';
import { Actor, fail, hash, id, text } from './types';
import { seedFund } from './seed';

@Injectable()
export class SandboxAuth implements OnModuleInit {
  private invite = '';
  constructor(private readonly db: SandboxDatabase) {}
  async onModuleInit() {
    await mkdir(this.db.directory, { recursive: true, mode: 0o700 });
    this.invite = process.env.SANDBOX_INVITE_CODE || '';
    if (!this.invite) {
      try {
        this.invite = (
          await readFile(join(this.db.directory, 'invite-code'), 'utf8')
        ).trim();
      } catch {
        this.invite = randomBytes(24).toString('base64url');
        await writeFile(join(this.db.directory, 'invite-code'), this.invite, {
          mode: 0o600,
        });
      }
    }
  }
  async register(body: any) {
    const supplied = hash(String(body.inviteCode || ''));
    if (!timingSafeEqual(Buffer.from(supplied), Buffer.from(hash(this.invite))))
      fail(
        403,
        'INVITATION_REQUIRED',
        'A valid sandbox invitation code is required.',
      );
    const email = text(body.email, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail(422, 'INVALID_EMAIL', 'Enter a valid email address.');
    const password = text(body.password, 128);
    if (password.length < 12)
      fail(422, 'WEAK_PASSWORD', 'Use at least 12 characters.');
    const name = text(body.name, 120);
    const salt = randomBytes(16).toString('hex');
    const digest = scryptSync(password, salt, 64).toString('hex');
    const userId = id(),
      orgId = id();
    await this.db.transaction(async (tx) => {
      if (
        (await tx.query('SELECT id FROM sb_users WHERE email=$1', [email])).rows
          .length
      )
        fail(
          409,
          'ACCOUNT_EXISTS',
          'An account already exists. Sign in instead.',
        );
      await tx.query(
        'INSERT INTO sb_users(id,email,name,password_hash) VALUES($1,$2,$3,$4)',
        [userId, email, name, `${salt}:${digest}`],
      );
      await tx.query('INSERT INTO sb_organizations(id,name) VALUES($1,$2)', [
        orgId,
        `${name} sandbox`,
      ]);
      await tx.query(
        'INSERT INTO sb_memberships(org_id,user_id,role) VALUES($1,$2,$3)',
        [orgId, userId, 'owner'],
      );
      await seedFund(tx, {
        id: userId,
        email,
        name,
        orgId,
        role: 'owner',
        generation: 1,
      });
    });
    return this.issue(userId, orgId);
  }
  async login(body: any) {
    const email = text(body.email, 254).toLowerCase();
    const password = text(body.password, 128);
    const row = (
      await this.db.query(
        'SELECT u.*,m.org_id FROM sb_users u JOIN sb_memberships m ON m.user_id=u.id WHERE email=$1',
        [email],
      )
    ).rows[0];
    const [salt, digest] = row
      ? row.password_hash.split(':')
      : ['invalid', '00'.repeat(64)];
    if (
      !timingSafeEqual(
        scryptSync(password, salt, 64),
        Buffer.from(digest, 'hex'),
      ) ||
      !row
    )
      fail(401, 'INVALID_LOGIN', 'Email or password is incorrect.');
    return this.issue(row.id, row.org_id);
  }
  private async issue(userId: string, orgId: string) {
    const token = randomBytes(32).toString('base64url');
    await this.db.query(
      "INSERT INTO sb_sessions(token_hash,user_id,org_id,expires_at) VALUES($1,$2,$3,now()+interval '12 hours')",
      [hash(token), userId, orgId],
    );
    return { token, user: await this.actor(token) };
  }
  async actor(token: string): Promise<Actor> {
    const row = (
      await this.db.query(
        `SELECT u.id,u.email,u.name,m.org_id,m.role,o.generation FROM sb_sessions s
      JOIN sb_users u ON s.user_id=u.id JOIN sb_memberships m ON m.user_id=u.id AND m.org_id=s.org_id
      JOIN sb_organizations o ON o.id=m.org_id WHERE s.token_hash=$1 AND s.expires_at>now()`,
        [hash(token)],
      )
    ).rows[0];
    if (!row) fail(401, 'UNAUTHORIZED', 'Sign in to your sandbox.');
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      orgId: row.org_id,
      role: row.role,
      generation: row.generation,
    };
  }
  async logout(token: string) {
    await this.db.query('DELETE FROM sb_sessions WHERE token_hash=$1', [
      hash(token),
    ]);
  }
}
