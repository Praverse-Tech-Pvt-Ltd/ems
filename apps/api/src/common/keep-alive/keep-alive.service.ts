import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

type TimeWindow = {
  startMinutes: number;
  endMinutes: number;
  label: string;
};

@Injectable()
export class KeepAliveService {
  private readonly logger = new Logger(KeepAliveService.name);

  constructor(private readonly config: ConfigService) {}

  // Render free instances spin down after idle time. During attendance windows,
  // ping every 5 minutes so the service stays warm for punch in/out traffic.
  @Cron('0 */5 * * * *')
  async ping(): Promise<void> {
    const selfUrl = this.config.get<string>('RENDER_SELF_URL');
    if (!selfUrl) return;

    const windows = this.getWindows();
    const currentMinutes = this.getCurrentMinutes();
    const activeWindow = windows.find((window) =>
      this.isInsideWindow(currentMinutes, window),
    );

    if (!activeWindow) return;

    try {
      await axios.get(`${selfUrl.replace(/\/$/, '')}/health`, {
        timeout: 10_000,
      });
      this.logger.debug(`Keep-alive ping succeeded for ${activeWindow.label}`);
    } catch {
      this.logger.warn(`Keep-alive ping failed for ${activeWindow.label}`);
    }
  }

  private getWindows(): TimeWindow[] {
    const raw = this.config.get<string>(
      'KEEP_ALIVE_WINDOWS',
      '08:45-10:30,17:20-18:30',
    );

    return raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [start, end] = part.split('-').map((value) => value.trim());
        return {
          startMinutes: this.parseTime(start),
          endMinutes: this.parseTime(end),
          label: part,
        };
      });
  }

  private getCurrentMinutes(): number {
    const timeZone = this.config.get<string>(
      'KEEP_ALIVE_TIMEZONE',
      'Asia/Kolkata',
    );
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const hourPart = parts.find((part) => part.type === 'hour')?.value;
    const minutePart = parts.find((part) => part.type === 'minute')?.value;
    if (!hourPart || !minutePart) {
      throw new Error(`Unable to resolve current time for ${timeZone}`);
    }
    const hour = Number(hourPart);
    const minute = Number(minutePart);
    return hour * 60 + minute;
  }

  private parseTime(value: string | undefined): number {
    if (!value || !/^\d{2}:\d{2}$/.test(value)) {
      throw new Error(`Invalid KEEP_ALIVE_WINDOWS time: ${value ?? ''}`);
    }
    const [hourPart, minutePart] = value.split(':');
    const hour = Number(hourPart);
    const minute = Number(minutePart);
    return hour * 60 + minute;
  }

  private isInsideWindow(currentMinutes: number, window: TimeWindow): boolean {
    if (window.startMinutes <= window.endMinutes) {
      return (
        currentMinutes >= window.startMinutes &&
        currentMinutes <= window.endMinutes
      );
    }

    return (
      currentMinutes >= window.startMinutes ||
      currentMinutes <= window.endMinutes
    );
  }
}
