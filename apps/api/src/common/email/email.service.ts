import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly logger = new Logger(EmailService.name);

  constructor(private config: ConfigService) {
    this.from = this.config.getOrThrow('SES_FROM_EMAIL');

    this.transporter = nodemailer.createTransport({
      host: this.config.getOrThrow('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT') ?? 587,
      secure: false,
      auth: {
        user: this.config.getOrThrow('SMTP_USER'),
        pass: this.config.getOrThrow('SMTP_PASS'),
      },
    });
  }

  async sendWelcome(to: string, name: string, tempPassword: string) {
    await this.send({
      to,
      subject: 'Welcome to NexGen EMS — Your Account Details',
      html: `
        <h2>Welcome, ${name}!</h2>
        <p>Your NexGen EMS account has been created.</p>
        <p><strong>Email:</strong> ${to}</p>
        <p><strong>Temporary Password:</strong> <code>${tempPassword}</code></p>
        <p>Please log in and change your password immediately.</p>
      `,
    });
  }

  async sendPasswordReset(to: string, name: string, resetLink: string) {
    await this.send({
      to,
      subject: 'NexGen EMS — Password Reset Request',
      html: `
        <h2>Hello, ${name}</h2>
        <p>Click the link below to reset your password. It expires in 1 hour.</p>
        <a href="${resetLink}">Reset Password</a>
        <p>If you didn't request this, ignore this email.</p>
      `,
    });
  }

  async sendLeaveDecision(
    to: string,
    name: string,
    status: 'APPROVED' | 'REJECTED',
    leaveType: string,
    dates: string,
    remarks?: string,
  ) {
    const label = status === 'APPROVED' ? 'Approved' : 'Rejected';
    await this.send({
      to,
      subject: `NexGen EMS — Leave Request ${label}`,
      html: `
        <h2>Hello, ${name}</h2>
        <p>Your <strong>${leaveType}</strong> leave request (${dates}) has been <strong>${label.toLowerCase()}</strong>.</p>
        ${remarks ? `<p><strong>Remarks:</strong> ${remarks}</p>` : ''}
      `,
    });
  }

  async sendExpenseDecision(
    to: string,
    name: string,
    status: string,
    amount: number,
    remarks?: string,
  ) {
    await this.send({
      to,
      subject: `NexGen EMS — Expense Request ${status}`,
      html: `
        <h2>Hello, ${name}</h2>
        <p>Your expense of <strong>₹${amount.toFixed(2)}</strong> has been <strong>${status.toLowerCase()}</strong>.</p>
        ${remarks ? `<p><strong>Remarks:</strong> ${remarks}</p>` : ''}
      `,
    });
  }

  async sendSalarySlipStatus(
    to: string,
    name: string,
    status: 'GENERATED' | 'APPROVED' | 'TRANSFERRED' | 'REJECTED',
    period: string,
    netPayable: number,
    details?: { paymentRef?: string; signatureName?: string },
  ) {
    const statusLabel = status.charAt(0) + status.slice(1).toLowerCase();
    await this.send({
      to,
      subject: `NexGen EMS — Salary Slip ${statusLabel}`,
      html: `
        <h2>Hello, ${name}</h2>
        <p>Your salary slip for <strong>${period}</strong> has been <strong>${statusLabel.toLowerCase()}</strong>.</p>
        <p><strong>Net payable:</strong> ₹${netPayable.toFixed(2)}</p>
        ${details?.paymentRef ? `<p><strong>Payment reference:</strong> ${details.paymentRef}</p>` : ''}
        ${details?.signatureName ? `<p><strong>Approved by:</strong> ${details.signatureName}</p>` : ''}
      `,
    });
  }

  private async send(opts: { to: string; subject: string; html: string }) {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      });
    } catch (err) {
      this.logger.error(`Failed to send email to ${opts.to}: ${(err as Error).message}`);
    }
  }
}
