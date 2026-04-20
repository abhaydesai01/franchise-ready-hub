import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsappCloudService } from './whatsapp-cloud.service';
import { WhatsappInboxService } from './whatsapp-inbox.service';
import { WhatsappInboxController } from './whatsapp-inbox.controller';

@Module({
  imports: [ConfigModule],
  controllers: [WhatsappInboxController],
  providers: [WhatsappCloudService, WhatsappInboxService],
  exports: [WhatsappCloudService, WhatsappInboxService],
})
export class WhatsappModule {}
