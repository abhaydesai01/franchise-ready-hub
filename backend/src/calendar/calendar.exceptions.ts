import { HttpException, HttpStatus } from '@nestjs/common';

export class SlotUnavailableException extends HttpException {
  constructor() {
    super(
      'That slot was just taken — please choose another.',
      HttpStatus.CONFLICT,
    );
  }
}
