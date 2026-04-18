import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }

  @Patch('availability')
  patchAvailability(@Body() dto: UpdateAvailabilityDto) {
    return this.settingsService.patchAvailability(dto);
  }

  @Patch('integrations/:id')
  updateIntegration(
    @Param('id') id: string,
    @Body() dto: { apiKey?: string; connected?: boolean },
  ) {
    return this.settingsService.updateIntegration(id, dto);
  }

  @Post('integrations/:id/test')
  testIntegration(@Param('id') id: string) {
    return this.settingsService.testIntegration(id);
  }

  @Post('calendly/test')
  testCalendly(@Body() body: { signingKey?: string }) {
    return this.settingsService.testCalendlyWebhook(body?.signingKey);
  }
}
