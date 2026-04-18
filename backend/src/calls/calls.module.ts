import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { DiscoveryCall, CallSchema } from './schemas/call.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DiscoveryCall.name, schema: CallSchema },
    ]),
  ],
  controllers: [CallsController],
  providers: [CallsService],
  exports: [CallsService],
})
export class CallsModule {}
