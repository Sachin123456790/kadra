import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { FundModule } from './modules/fund/fund.module';
import { IdentityModule } from './modules/identity/identity.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { SettlementsModule } from './modules/settlements/settlements.module';
import { TokenizationModule } from './modules/tokenization/tokenization.module';
import { OwnershipModule } from './modules/ownership/ownership.module';
import { DistributionModule } from './modules/distribution/distribution.module';
import { AuditModule } from './modules/audit/audit.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { AuthModule } from './modules/auth/auth.module';
import { InvestorPortalModule } from './modules/investor-portal/investor-portal.module';
import { CapitalCallsModule } from './modules/capital-calls/capital-calls.module';
import { NoticesModule } from './modules/notices/notices.module';
import { HealthController } from './health.controller';
import { EventLogModule } from './common/event-log.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EventLogModule,
    FundModule,
    IdentityModule,
    DocumentsModule,
    SubscriptionsModule,
    SettlementsModule,
    TokenizationModule,
    OwnershipModule,
    DistributionModule,
    AuditModule,
    JobsModule,
    AuthModule,
    InvestorPortalModule,
    CapitalCallsModule,
    NoticesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
