import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppSettings, AppSettingsSchema } from '../settings/schemas/settings.schema';
import { VaaniService } from './vaani.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AppSettings.name, schema: AppSettingsSchema },
    ]),
  ],
  providers: [VaaniService],
  exports: [VaaniService],
})
export class VaaniModule {}
