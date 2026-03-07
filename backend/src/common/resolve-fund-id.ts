import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from './errors';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveFundId(
  prisma: PrismaService,
  fundIdOrCode: string,
): Promise<string> {
  if (UUID_REGEX.test(fundIdOrCode)) return fundIdOrCode;
  const fund = await prisma.fund.findFirst({
    where: { code: fundIdOrCode, deletedAt: null },
    select: { id: true },
  });
  if (!fund) throw new NotFoundError('Fund', fundIdOrCode);
  return fund.id;
}
