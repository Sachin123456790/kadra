import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { schema } from './schema';
import { Queryable } from './types';

@Injectable()
export class SandboxDatabase implements OnModuleInit, OnModuleDestroy {
  private context = new AsyncLocalStorage<string>();
  private embedded?: PGlite;
  private pool?: Pool;
  get directory() {
    return resolve(process.env.SANDBOX_DATA_DIR || '.sandbox');
  }
  async onModuleInit() {
    // An explicit sandbox URL is required. Never reuse the legacy production URL.
    if (process.env.SANDBOX_DATABASE_URL) {
      this.pool = new Pool({
        connectionString: process.env.SANDBOX_DATABASE_URL,
        max: 3,
      });
      await this.pool.query(schema);
    } else {
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      this.embedded = new PGlite(resolve(this.directory, 'postgres'));
      await this.embedded.exec(schema);
    }
  }
  async query(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
    if (this.context.getStore())
      return this.transaction((tx) => tx.query(sql, params));
    return this.pool
      ? this.pool.query(sql, params)
      : this.embedded!.query(sql, params);
  }
  as<T>(orgId: string, fn: () => Promise<T>) {
    return this.context.run(orgId, fn);
  }
  private async scoped<T>(tx: Queryable, fn: (db: Queryable) => Promise<T>) {
    const orgId = this.context.getStore();
    if (orgId) {
      await tx.query('SET LOCAL ROLE angainor_sandbox');
      await tx.query("SELECT set_config('angainor.org_id',$1,true)", [orgId]);
    }
    return fn(tx);
  }
  async transaction<T>(fn: (db: Queryable) => Promise<T>): Promise<T> {
    if (this.embedded)
      return this.embedded.transaction((tx) => this.scoped(tx, fn));
    const client = await this.pool!.connect();
    try {
      await client.query('BEGIN');
      const value = await this.scoped(client, fn);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async onModuleDestroy() {
    await this.embedded?.close();
    await this.pool?.end();
  }
}
