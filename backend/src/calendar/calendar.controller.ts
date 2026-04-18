import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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

  @Get('available-slots')
  @UseGuards(JwtAuthGuard)
  async availableSlots(@Query('count') countStr?: string) {
    const count = Math.min(Math.max(parseInt(countStr || '500', 10) || 500, 1), 1000);
    return this.calendar.getAvailableSlots('bot', count);
  }

  @Post('book')
  @UseGuards(JwtAuthGuard)
  async bookSlot(
    @Body()
    body: {
      leadId: string;
      startTime: string;
      endTime: string;
    },
  ) {
    const lead = await this.leadModel.findById(body.leadId).lean().exec();
    if (!lead) {
      throw new (await import('@nestjs/common')).NotFoundException('Lead not found');
    }
    return this.calendar.bookSlot({
      leadId: body.leadId,
      slotStartTime: new Date(body.startTime),
      slotEndTime: new Date(body.endTime),
      leadName: (lead as any).name ?? 'Lead',
      leadEmail: (lead as any).email ?? '',
      leadPhone: (lead as any).phone,
      bookedVia: 'crm_bot',
    });
  }

  @Get('events')
  @UseGuards(JwtAuthGuard)
  async events(
    @CurrentUser() user: CurrentUserPayload,
    @Query('timeMin') timeMin: string,
    @Query('timeMax') timeMax: string,
  ) {
    return this.calendar.getEvents(user._id, timeMin, timeMax);
  }

  @Post('create-event')
  @UseGuards(JwtAuthGuard)
  async createEvent(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      title: string;
      startTime: string;
      endTime: string;
      description?: string;
      attendeeEmail?: string;
      createMeet?: boolean;
    },
  ) {
    return this.calendar.createManualEvent(user._id, body);
  }

  @Patch('events/:eventId')
  @UseGuards(JwtAuthGuard)
  async rescheduleEvent(
    @CurrentUser() user: CurrentUserPayload,
    @Param('eventId') eventId: string,
    @Body()
    body: {
      startTime: string;
      endTime: string;
    },
  ) {
    return this.calendar.rescheduleEvent(user._id, eventId, body.startTime, body.endTime);
  }

  @Delete('events/:eventId')
  @UseGuards(JwtAuthGuard)
  async deleteEvent(
    @CurrentUser() user: CurrentUserPayload,
    @Param('eventId') eventId: string,
  ) {
    return this.calendar.deleteEvent(user._id, eventId);
  }
}
