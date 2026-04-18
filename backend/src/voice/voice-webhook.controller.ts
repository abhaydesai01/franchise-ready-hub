import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { VoiceWebhookService } from './voice-webhook.service';

@Controller('webhooks')
export class VoiceWebhookController {
  constructor(private readonly voice: VoiceWebhookService) {}

  /** VAPI server URL: POST https://<api>/api/v1/webhooks/voice */
  @Post('voice')
  @HttpCode(200)
  async handleVoice(@Body() body: Record<string, unknown>) {
    return this.voice.handleEvent(body);
  }
}
