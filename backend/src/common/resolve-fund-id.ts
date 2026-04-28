import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from './errors';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FUND_CODE_ALIASES: Record<string, string> = {
  'KADRA-DEMO-001': 'ANGAINOR-DEMO-001',
};

export async function resolveFundId(
  prisma: PrismaService,
  fundIdOrCode: string,
): Promise<string> {
  if (UUID_REGEX.test(fundIdOrCode)) return fundIdOrCode;
  const code = FUND_CODE_ALIASES[fundIdOrCode] ?? fundIdOrCode;
  const fund = await prisma.fund.findFirst({
    where: { code, deletedAt: null },
    select: { id: true },
  });
  if (!fund) throw new NotFoundError('Fund', fundIdOrCode);
  return fund.id;
}
