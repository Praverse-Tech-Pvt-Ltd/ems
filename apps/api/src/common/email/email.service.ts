import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { createResendClient } from './resend.client';
import { render } from '@react-email/components';
import * as React from 'react';
import { QUEUE_EMAIL_NAME } from './email.constants';

import {
  WelcomeEmail,
  getWelcomeText,
  OtpEmail,
  getOtpText,
  PasswordResetConfirmEmail,
  getPasswordResetConfirmText,
  PunchConfirmationEmail,
  getPunchConfirmationText,
  MissingPunchOutAlertEmail,
  getMissingPunchOutAlertText,
  RequestStatusEmail,
  getRequestStatusText,
  ExpenseStatusEmail,
  getExpenseStatusText,
  LeaveStatusEmail,
  getLeaveStatusText,
  SalarySlipAlertEmail,
  getSalarySlipAlertText,
  AdminMissingPunchSummaryEmail,
  getAdminMissingPunchSummaryText,
} from './templates';

@Injectable()
export class EmailService {
  private readonly resend: ReturnType<typeof createResendClient>;
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {
    const apiKey = this.config.getOrThrow<string>('RESEND_API_KEY');
    this.resend = createResendClient(apiKey);
  }

  // Helper helper to enqueue jobs
  private async enqueue(action: string, to: string, employeeId: string | undefined, payload: any) {
    await this.emailQueue.add(
      action,
      {
        action,
        to,
        employeeId,
        ...payload,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5 seconds
        },
      },
    );
  }

  // 1. Send OTP (Direct, not enqueued to avoid authentication delay)
  async sendOtp(to: string, otpCode: string) {
    const from = `${this.config.get<string>('RESEND_FROM_NAME', 'NexGen Pharma EMS')} <${this.config.get<string>('RESEND_FROM_EMAIL', 'noreply@nexgenpharma.com')}>`;
    const html = await render(React.createElement(OtpEmail, { otpCode }));
    const text = getOtpText(otpCode);

    const response = await this.resend.emails.send({
      from,
      to,
      subject: 'Verify Your Identity — NexGen Pharma',
      html,
      text,
    });

    if (response.error) {
      this.logger.error(`Failed to send OTP to ${to}: ${JSON.stringify(response.error)}`);
      throw new Error(`Failed to send OTP: ${JSON.stringify(response.error)}`);
    }

    this.logger.log(`OTP sent directly to ${to}`);
    return response;
  }

  // 2. Welcome Email (Backward compatibility & Enqueued)
  async sendWelcome(to: string, name: string, tempPassword: string) {
    const employee = await this.prisma.employee.findUnique({ where: { email: to } });
    await this.enqueue('welcome', to, employee?.id, { name, tempPassword });
  }

  // 3. Password Reset Confirm (Enqueued)
  async sendPasswordResetConfirm(employeeId: string, to: string, name: string, resetLink: string) {
    await this.enqueue('password_reset_confirm', to, employeeId, { name, resetLink });
  }

  // 4. Punch Confirmation (Enqueued)
  async sendPunchConfirmation(employeeId: string, to: string, name: string, type: 'PUNCH_IN' | 'PUNCH_OUT', time: string) {
    await this.enqueue('punch_confirmation', to, employeeId, { name, type, time });
  }

  // 5. Missing Punch Out Alert (Enqueued)
  async sendMissingPunchOutAlert(employeeId: string, to: string, name: string, date: string) {
    await this.enqueue('missing_punch_out', to, employeeId, { name, date });
  }

  // 6. Request Status (Enqueued)
  async sendRequestStatus(employeeId: string, to: string, name: string, requestType: string, status: string, remarks?: string) {
    await this.enqueue('request_status', to, employeeId, { name, requestType, status, remarks });
  }

  // 7. Expense Status (Enqueued)
  async sendExpenseStatus(employeeId: string, to: string, name: string, amount: number, status: string, remarks?: string) {
    await this.enqueue('expense_status', to, employeeId, { name, amount, status, remarks });
  }

  // 8. Leave Status (Enqueued)
  async sendLeaveStatus(employeeId: string, to: string, name: string, leaveType: string, dates: string, status: string, remarks?: string) {
    await this.enqueue('leave_status', to, employeeId, { name, leaveType, dates, status, remarks });
  }

  // 9. Salary Slip Alert (Enqueued)
  async sendSalarySlipAlert(employeeId: string, to: string, name: string, period: string, netPayable: number, status: string, details?: any) {
    await this.enqueue('salary_slip_alert', to, employeeId, { name, period, netPayable, status, details });
  }

  // 10. Admin Missing Punch Summary (Enqueued)
  async sendAdminMissingPunchSummary(to: string, date: string, employees: Array<{ name: string; department: string }>) {
    await this.enqueue('admin_missing_punch_summary', to, undefined, { date, employees });
  }

  // --- Backward Compatibility Mappings ---
  async sendPasswordReset(to: string, name: string, resetLink: string) {
    const employee = await this.prisma.employee.findUnique({ where: { email: to } });
    await this.sendPasswordResetConfirm(employee?.id || '', to, name, resetLink);
  }

  async sendLeaveDecision(
    to: string,
    name: string,
    status: 'APPROVED' | 'REJECTED',
    leaveType: string,
    dates: string,
    remarks?: string,
  ) {
    const employee = await this.prisma.employee.findUnique({ where: { email: to } });
    await this.sendLeaveStatus(employee?.id || '', to, name, leaveType, dates, status, remarks);
  }

  async sendExpenseDecision(
    to: string,
    name: string,
    status: string,
    amount: number,
    remarks?: string,
  ) {
    const employee = await this.prisma.employee.findUnique({ where: { email: to } });
    await this.sendExpenseStatus(employee?.id || '', to, name, amount, status, remarks);
  }

  async sendSalarySlipStatus(
    to: string,
    name: string,
    status: 'GENERATED' | 'APPROVED' | 'TRANSFERRED' | 'REJECTED',
    period: string,
    netPayable: number,
    details?: { paymentRef?: string; signatureName?: string },
  ) {
    const employee = await this.prisma.employee.findUnique({ where: { email: to } });
    await this.sendSalarySlipAlert(employee?.id || '', to, name, period, netPayable, status, details);
  }

  // --- Job Execution (invoked by EmailProcessor) ---
  async executeSendJob(data: any) {
    const { action, to } = data;
    let html = '';
    let text = '';
    let subject = '';

    switch (action) {
      case 'welcome': {
        const { name, tempPassword } = data;
        html = await render(React.createElement(WelcomeEmail, { name, email: to, tempPassword }));
        text = getWelcomeText(name, to, tempPassword);
        subject = 'Welcome to NexGen EMS — Your Account Details';
        break;
      }
      case 'password_reset_confirm': {
        const { name, resetLink } = data;
        html = await render(React.createElement(PasswordResetConfirmEmail, { name, resetLink }));
        text = getPasswordResetConfirmText(name, resetLink);
        subject = 'NexGen EMS — Password Reset Request';
        break;
      }
      case 'punch_confirmation': {
        const { name, type, time } = data;
        html = await render(React.createElement(PunchConfirmationEmail, { name, type, time }));
        text = getPunchConfirmationText(name, type, time);
        subject = `NexGen EMS — Punch Registered Successfully`;
        break;
      }
      case 'missing_punch_out': {
        const { name, date } = data;
        html = await render(React.createElement(MissingPunchOutAlertEmail, { name, date }));
        text = getMissingPunchOutAlertText(name, date);
        subject = 'NexGen EMS — Missing Punch Out Alert';
        break;
      }
      case 'request_status': {
        const { name, requestType, status, remarks } = data;
        html = await render(React.createElement(RequestStatusEmail, { name, requestType, status, remarks }));
        text = getRequestStatusText(name, requestType, status, remarks);
        subject = `NexGen EMS — Request for ${requestType} is ${status}`;
        break;
      }
      case 'expense_status': {
        const { name, amount, status, remarks } = data;
        html = await render(React.createElement(ExpenseStatusEmail, { name, amount, status, remarks }));
        text = getExpenseStatusText(name, amount, status, remarks);
        subject = `NexGen EMS — Expense Request ${status}`;
        break;
      }
      case 'leave_status': {
        const { name, leaveType, dates, status, remarks } = data;
        html = await render(React.createElement(LeaveStatusEmail, { name, leaveType, dates, status, remarks }));
        text = getLeaveStatusText(name, leaveType, dates, status, remarks);
        subject = `NexGen EMS — Leave Application ${status}`;
        break;
      }
      case 'salary_slip_alert': {
        const { name, period, netPayable, status, details } = data;
        html = await render(React.createElement(SalarySlipAlertEmail, { name, period, netPayable, status, details }));
        text = getSalarySlipAlertText(name, period, netPayable, status, details);
        subject = `NexGen EMS — Salary Slip ${status}`;
        break;
      }
      case 'admin_missing_punch_summary': {
        const { date, employees } = data;
        html = await render(React.createElement(AdminMissingPunchSummaryEmail, { date, employees }));
        text = getAdminMissingPunchSummaryText(date, employees);
        subject = `NexGen EMS — Missing Punch Daily Summary (${date})`;
        break;
      }
      default:
        throw new Error(`Unsupported email action: ${action}`);
    }

    const from = `${this.config.get<string>('RESEND_FROM_NAME', 'NexGen Pharma EMS')} <${this.config.get<string>('RESEND_FROM_EMAIL', 'noreply@nexgenpharma.com')}>`;
    const response = await this.resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
    });

    if (response.error) {
      throw new Error(`Resend API Error: ${JSON.stringify(response.error)}`);
    }

    this.logger.log(`Email successfully sent for action: ${action} to ${to}`);
  }
}
