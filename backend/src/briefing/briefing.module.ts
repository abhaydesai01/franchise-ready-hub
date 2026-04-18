import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { UsersModule } from '../users/users.module';
import { BriefingService } from './briefing.service';
import { BriefingPdfService } from './briefing-pdf.service';
import { BriefingPrecallMailService } from './briefing-precall-mail.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Lead.name, schema: LeadSchema }]),
    UsersModule,
  ],
  providers: [BriefingService, BriefingPdfService, BriefingPrecallMailService],
  exports: [BriefingService, BriefingPdfService, BriefingPrecallMailService],
})
export class BriefingModule {}
