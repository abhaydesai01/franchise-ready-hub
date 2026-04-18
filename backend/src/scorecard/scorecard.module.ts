import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeadsModule } from '../leads/leads.module';
import { SettingsModule } from '../settings/settings.module';
import { ActivitiesModule } from '../activities/activities.module';
import { CrmSettings, CrmSettingsSchema } from './schemas/crm-settings.schema';
import { ScorecardService } from './scorecard.service';
import { ScorecardPdfService } from './scorecard-pdf.service';
import { ScorecardStorageService } from './scorecard-storage.service';
import { ScorecardEmailService } from './scorecard-email.service';
import { ScorecardWhatsappService } from './scorecard-whatsapp.service';
import { InternalScorecardController } from './internal-scorecard.controller';
import { InternalScorecardKeyGuard } from './internal-scorecard.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CrmSettings.name, schema: CrmSettingsSchema },
    ]),
    LeadsModule,
    SettingsModule,
    ActivitiesModule,
  ],
  controllers: [InternalScorecardController],
  providers: [
    ScorecardService,
    ScorecardPdfService,
    ScorecardStorageService,
    ScorecardEmailService,
    ScorecardWhatsappService,
    InternalScorecardKeyGuard,
  ],
  exports: [ScorecardService],
})
export class ScorecardModule {}
