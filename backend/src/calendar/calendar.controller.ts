import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type CurrentUserPayload } from '../auth/current-user.decorator';
import { CalendarService } from './calendar.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';

@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly calendar: CalendarService,
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
  ) {}

  @Get('google/connect')
  @UseGuards(JwtAuthGuard)
  @HttpCode(302)
  googleConnect(
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
  ) {
    const url = this.calendar.buildGoogleAuthUrl(user._id);
    return res.redirect(url);
  }

  @Get('google/callback')
  @HttpCode(302)
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const redirect = await this.calendar.handleGoogleCallback(code, state);
    return res.redirect(redirect);
  }

  @Get('google/disconnect')
  @UseGuards(JwtAuthGuard)
  async googleDisconnect(@CurrentUser() user: CurrentUserPayload) {
    return this.calendar.disconnectGoogle(user._id);
  }

  @Get('outlook/connect')
  @UseGuards(JwtAuthGuard)
  @HttpCode(302)
  outlookConnect(
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
  ) {
    const url = this.calendar.buildOutlookAuthUrl(user._id);
    return res.redirect(url);
  }

  @Get('outlook/callback')
  @HttpCode(302)
  async outlookCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const redirect = await this.calendar.handleOutlookCallback(code, state);
    return res.redirect(redirect);
  }

  @Get('outlook/disconnect')
  @UseGuards(JwtAuthGuard)
  async outlookDisconnect(@CurrentUser() user: CurrentUserPayload) {
    return this.calendar.disconnectOutlook(user._id);
  }

  @Get('integration-status')
  @UseGuards(JwtAuthGuard)
  status(@CurrentUser() user: CurrentUserPayload) {
    return this.calendar.getIntegrationStatus(user._id);
  }

  @Get('test-slots')
  @UseGuards(JwtAuthGuard)
  async testSlots() {
    return this.calendar.getAvailableSlots('bot', 5);
  }

  @Get('upcoming')
  @UseGuards(JwtAuthGuard)
  async upcoming() {
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const leads = await this.leadModel
      .find({
        'discoveryCall.status': 'scheduled',
        'discoveryCall.scheduledAt': { $gte: now, $lte: end },
      })
      .select('name discoveryCall')
      .sort({ 'discoveryCall.scheduledAt': 1 })
      .limit(50)
      .lean<
        Array<{
          _id: unknown;
          name: string;
          discoveryCall?: {
            scheduledAt?: Date;
            meetLink?: string;
            meetingLink?: string;
          };
        }>
      >()
      .exec();

    return leads.map((l) => ({
      leadId: String(l._id),
      leadName: l.name,
      scheduledAt: l.discoveryCall?.scheduledAt,
      meetLink: l.discoveryCall?.meetLink ?? l.discoveryCall?.meetingLink ?? '',
      profileUrl: `/leads/${String(l._id)}`,
    }));
  }
}
