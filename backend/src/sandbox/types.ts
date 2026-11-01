import { createHash, randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';

export type Actor = {
  id: string;
  email: string;
  name: string;
  orgId: string;
  role: string;
  generation: number;
};
export type Queryable = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
};
export type Evidence = {
  documentId: string;
  version: number;
  page?: number;
  section?: string;
  sheet?: string;
  cells?: string;
  text: string;
  method: string;
};
export type Rule = {
  id: string;
  key: string;
  value: any;
  investorId?: string;
  effectiveFrom: string;
  sourceId: string;
  decision: string;
  reviewerId: string;
};
export const id = () => randomUUID();
export const hash = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');
export function canonical(value: any): any {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((k) => value[k] !== undefined)
        .map((k) => [k, canonical(value[k])]),
    );
  return value;
}
export const fingerprint = (value: unknown) =>
  hash(JSON.stringify(canonical(value)));
export function fail(status: number, code: string, message: string): never {
  throw new HttpException({ code, message }, status);
}
export function allow(actor: Actor, roles: string[]) {
  if (actor.role !== 'owner' && !roles.includes(actor.role))
    fail(403, 'FORBIDDEN', 'Your role does not allow this action.');
}
export function requireRevision(actual: number, supplied: number) {
  if (actual !== supplied)
    fail(
      409,
      'STALE_REVISION',
      'The record changed. Refresh and review the latest version.',
    );
}
export function date(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    fail(422, 'INVALID_DATE', 'Use a valid YYYY-MM-DD date.');
  return value as string;
}
export function text(value: unknown, max = 2000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    fail(422, 'INVALID_TEXT', `A value of 1–${max} characters is required.`);
  return (value as string).trim();
}
