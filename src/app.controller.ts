import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  root() {
    return {
      ok: true,
      service: 'kasicash-api',
    };
  }

  @Get('health')
  health() {
    return { ok: true };
  }
}
