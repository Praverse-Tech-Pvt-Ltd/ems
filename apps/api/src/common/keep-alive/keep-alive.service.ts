import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class KeepAliveService {
  private readonly logger = new Logger(KeepAliveService.name);

  constructor(private readonly config: ConfigService) {}

  // Fires every 14 min — just under Render's 15-min idle spin-down threshold.
  // Only active when RENDER_SELF_URL is set. Set it on at most ONE service to
  // stay within Render's 750 free instance-hours/month (720 hrs for 24/7).
  @Cron('0 */14 * * * *')
  async ping(): Promise<void> {
    const selfUrl = this.config.get<string>('RENDER_SELF_URL');
    if (!selfUrl) return;

    try {
      await axios.get(`${selfUrl}/health`, { timeout: 10_000 });
    } catch {
      this.logger.warn('Keep-alive ping failed — service may be cold-starting');
    }
  }
}
