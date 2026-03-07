import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('version')
  version() {
    return { version: '0.1.0', name: 'kadra-api' };
  }
}
