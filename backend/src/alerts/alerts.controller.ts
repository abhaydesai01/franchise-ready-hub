import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AlertsService } from './alerts.service';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  list(@Query('priority') priority?: 'all' | 'critical' | 'warning' | 'info') {
    return this.alertsService.list({ priority: priority ?? 'all' });
  }

  @Get('counts')
  counts() {
    return this.alertsService.counts();
  }

  @Patch(':id/dismiss')
  dismiss(@Param('id') id: string) {
    return this.alertsService.dismiss(id);
  }

  @Post(':id/action')
  runAction(
    @Param('id') id: string,
    @Body() body?: { note?: string },
  ) {
    return this.alertsService.executeAction(id, body?.note);
  }
}
