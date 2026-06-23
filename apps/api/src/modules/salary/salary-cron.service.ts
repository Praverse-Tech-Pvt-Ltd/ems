import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SalaryService } from './salary.service';

@Injectable()
export class SalaryCronService {
  private readonly logger = new Logger(SalaryCronService.name);

  constructor(private readonly salaryService: SalaryService) {}

  @Cron('30 23 * * 6', { name: 'weekly-wage-sheet-refresh', timeZone: 'Asia/Kolkata' })
  async refreshWeeklyWageSheet() {
    try {
      const result = await this.salaryService.autoRefreshWeeklyPayrollRun();
      if (result.skipped) {
        this.logger.log(`Skipped weekly wage sheet refresh for ${result.month}/${result.year}: ${result.reason}`);
        return;
      }

      this.logger.log(`Auto-refreshed wage sheet ${result.id} for ${result.month}/${result.year}`);
    } catch (error) {
      this.logger.error('Weekly wage sheet refresh failed', error instanceof Error ? error.stack : String(error));
    }
  }
}
