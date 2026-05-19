import * as React from 'react';
import { EmailLayout } from './layout';
import { Button, Section, Text, Heading } from '@react-email/components';

// -------------------------------------------------------------
// 0. Welcome Email Template
// -------------------------------------------------------------
export interface WelcomeEmailProps {
  name: string;
  email: string;
  tempPassword: string;
}

export const WelcomeEmail: React.FC<WelcomeEmailProps> = ({ name, email, tempPassword }) => {
  return (
    <EmailLayout previewText={`Welcome to NexGen EMS, ${name}!`} title="Welcome to NexGen Pharma">
      <Text style={bodyText}>
        Hello {name},
      </Text>
      <Text style={bodyText}>
        Your NexGen EMS account has been created successfully. Below are your temporary login details:
      </Text>
      <Section style={card}>
        <Text style={{ margin: '4px 0', fontSize: '16px' }}>
          Email/Username: <strong>{email}</strong>
        </Text>
        <Text style={{ margin: '4px 0', fontSize: '16px' }}>
          Temporary Password: <code style={codeText}>{tempPassword}</code>
        </Text>
      </Section>
      <Text style={bodyText}>
        Please log in and update your password immediately to ensure your account remains secure.
      </Text>
    </EmailLayout>
  );
};

export const getWelcomeText = (name: string, email: string, tempPassword: string): string => `
NEXGEN PHARMA EMS
Welcome to NexGen Pharma

Hello ${name},

Your NexGen EMS account has been created successfully. Below are your temporary login details:

Email/Username: ${email}
Temporary Password: ${tempPassword}

Please log in and update your password immediately to ensure your account remains secure.

NexGen Pharma Solutions Pvt. Ltd.
`;

// -------------------------------------------------------------
// 1. OTP Email Template
// -------------------------------------------------------------
export interface OtpEmailProps {
  otpCode: string;
}

export const OtpEmail: React.FC<OtpEmailProps> = ({ otpCode }) => {
  return (
    <EmailLayout previewText={`Your OTP verification code: ${otpCode}`} title="Verify Your Identity">
      <Text style={bodyText}>
        Hello,
      </Text>
      <Text style={bodyText}>
        We received a request to verify your identity. Please use the following One-Time Password (OTP) to proceed:
      </Text>
      <Section style={card}>
        <Heading style={otpHeading}>{otpCode}</Heading>
      </Section>
      <Text style={bodyText}>
        This code is valid for <strong>10 minutes</strong>. If you did not make this request, please change your password immediately.
      </Text>
    </EmailLayout>
  );
};

export const getOtpText = (otpCode: string): string => `
NEXGEN PHARMA EMS
Verify Your Identity

Hello,
We received a request to verify your identity. Please use the following One-Time Password (OTP) to proceed:

${otpCode}

This code is valid for 10 minutes. If you did not make this request, please change your password immediately.

NexGen Pharma Solutions Pvt. Ltd.
`;

// -------------------------------------------------------------
// 2. Password Reset Confirm
// -------------------------------------------------------------
export interface PasswordResetConfirmProps {
  name: string;
  resetLink: string;
}

export const PasswordResetConfirmEmail: React.FC<PasswordResetConfirmProps> = ({ name, resetLink }) => {
  return (
    <EmailLayout previewText="Reset your NexGen EMS password" title="Password Reset Request">
      <Text style={bodyText}>
        Hello {name},
      </Text>
      <Text style={bodyText}>
        You requested a password reset for your NexGen EMS account. Click the button below to set a new password:
      </Text>
      <Section style={{ margin: '24px 0', textAlign: 'center' as const }}>
        <Button href={resetLink} style={btn}>
          Reset Password
        </Button>
      </Section>
      <Text style={bodyText}>
        Or copy and paste this link in your browser:
      </Text>
      <Text style={codeStyle}>{resetLink}</Text>
      <Text style={bodyText}>
        This link expires in <strong>1 hour</strong>. If you did not request this reset, you can safely ignore this email.
      </Text>
    </EmailLayout>
  );
};

export const getPasswordResetConfirmText = (name: string, resetLink: string): string => `
NEXGEN PHARMA EMS
Password Reset Request

Hello ${name},

You requested a password reset for your NexGen EMS account. Click the link below to set a new password:

${resetLink}

This link expires in 1 hour. If you did not request this reset, you can safely ignore this email.

NexGen Pharma Solutions Pvt. Ltd.
`;

// -------------------------------------------------------------
// 3. Punch Confirmation
// -------------------------------------------------------------
export interface PunchConfirmationProps {
  name: string;
  type: 'PUNCH_IN' | 'PUNCH_OUT';
  time: string;
}

export const PunchConfirmationEmail: React.FC<PunchConfirmationProps> = ({ name, type, time }) => {
  const isPunchIn = type === 'PUNCH_IN';
  const actionText = isPunchIn ? 'PUNCHED IN' : 'PUNCHED OUT';

  return (
    <EmailLayout previewText={`Successful ${actionText.toLowerCase()}`} title="Punch Registered">
      <Text style={bodyText}>
        Hello {name},
      </Text>
      <Text style={bodyText}>
        Your attendance punch was recorded successfully:
      </Text>
      <Section style={card}>
        <Text style={{ margin: '4px 0', fontSize: '16px' }}>
          Activity Type: <strong style={{ color: isPunchIn ? '#2e7d32' : '#d32f2f' }}>{actionText}</strong>
        </Text>
        <Text style={{ margin: '4px 0', fontSize: '16px' }}>
          Timestamp: <strong>{time}</strong>
        </Text>
      </Section>
      <Text style={bodyText}>
        Thank you for keeping your attendance up to date!
      </Text>
    </EmailLayout>
  );
};

export const getPunchConfirmationText = (name: string, type: string, time: string): string => `
NEXGEN PHARMA EMS
Punch Registered

Hello ${name},

Your attendance punch was recorded successfully:

Activity Type: ${type}
Timestamp: ${time}

Thank you for keeping your attendance up to date!

NexGen Pharma Solutions Pvt. Ltd.
`;

// -------------------------------------------------------------
// 4. Missing Punch Out Alert
// -------------------------------------------------------------
export interface MissingPunchOutAlertProps {
  name: string;
  date: string;
}

export const MissingPunchOutAlertEmail: React.FC<MissingPunchOutAlertProps> = ({ name, date }) => {
  return (
    <EmailLayout previewText="Missing punch out detected" title="Missing Punch Out Alert">
      <Text style={bodyText}>
        Hello {name},
      </Text>
      <Text style={bodyText}>
        We noticed you punched in on <strong>{date}</strong>, but did not record a corresponding punch out.
      </Text>
      <Text style={bodyText}>
        Please submit a <strong>Punch Correction Request</strong> in the NexGen EMS portal as soon as possible to ensure your working hours and salary are computed correctly.
      </Text>
    </EmailLayout>
  );
};

export const getMissingPunchOutAlertText = (name: string, date: string): string => `
NEXGEN PHARMA EMS
Missing Punch Out Alert

Hello ${name},

We noticed you punched in on ${date}, but did not record a corresponding punch out.

Please submit a Punch Correction Request in the NexGen EMS portal as soon as possible to ensure your working hours and salary are computed correctly.

NexGen Pharma Solutions Pvt. Ltd.
`;

// -------------------------------------------------------------
// 5. Request Status (WFH, Advance, etc.)
// -------------------------------------------------------------
export interface RequestStatusProps {
  name: string;
  requestType: string;
  status: string;
  remarks?: string;
}

export const RequestStatusEmail: React.FC<RequestStatusProps> = ({ name, requestType, status, remarks }) => {
  const isApproved = status.toUpperCase() === 'APPROVED';
  return (
    <EmailLayout previewText={`Your ${requestType} request has been ${status}`} title="Request Update">
      <Text style={bodyText}>
        Hello {name},
      </Text>
      <Text style={bodyText}>
        Your request for <strong>{requestType}</strong> has been updated:
      </Text>
      <Section style={card}>
        <Text style={{ margin: '4px 0', fontSize: '16px' }}>
          Status: <strong style={{ color: isApproved ? '#2e7d32' : '#d32f2f' }}>{status.toUpperCase()}</strong>
        </Text>
        {remarks && (
          <Text style={{ margin: '8px 0 4px 0', fontSize: '14px', fontStyle: 'italic' }}>
            Approver Remarks: "{remarks}"
          </Text>
        )}
      </Section>
    </EmailLayout>
  );
};

export const getRequestStatusText = (name: string, requestType: string, status: string, remarks?: string): string => `
NEXGEN PHARMA EMS
Request Update

Hello ${name},

Your request for ${requestType} has been updated:

Status: ${status.toUpperCase()}
${remarks ? `Remarks: "${remarks}"` : ''}

NexGen Pharma Solutions Pvt. Ltd.
`;

// -------------------------------------------------------------
// 6. Expense Status
// -------------------------------------------------------------
export interface ExpenseStatusProps {
  name: string;
  amount: number;
  status: string;
  remarks?: string;
}

export const ExpenseStatusEmail: React.FC<ExpenseStatusProps> = ({ name, amount, status, remarks }) => {
  const isApproved = status.toUpperCase() === 'APPROVED';
  return (
    <EmailLayout previewText={`Expense of ₹${amount.toFixed(2)} is ${status.toLowerCase()}`} title="Expense Reimbursement">
      <Text style={bodyText}>
        Hello {name},
      </Text>
      <Text style={bodyText}>
        Your expense reimbursement request has been processed:
      </Text>
      <Section style={card}>
        <Text style={{ margin: '4px 0', fontSize: '16px' }}>
          Amount: <strong>₹{amount.toFixed(2)}</strong>
        </Text>
        <Text style={{ margin: '4px 0', fontSize: '16px' }}>
          Status: <strong style={{ color: isApproved ? '#2e7d32' : '#d32f2f' }}>{status.toUpperCase()}</strong>
        </Text>
        {remarks && (
          <Text style={{ margin: '8px 0 4px 0', fontSize: '14px', fontStyle: 'italic' }}>
            Approver Remarks: "{remarks}"
          </Text>
        )}
      </Section>
    </EmailLayout>
  );
};

export const getExpenseStatusText = (name: string, amount: number, status: string, remarks?: string): string => `
NEXGEN PHARMA EMS
Expense Reimbursement

Hello ${name},

Your expense reimbursement request has been processed:

Amount: ₹${amount.toFixed(2)}
Status: ${status.toUpperCase()}
${remarks ? `Remarks: "${remarks}"` : ''}

NexGen Pharma Solutions Pvt. Ltd.
`;

// -------------------------------------------------------------
// 7. Leave Status
// -------------------------------------------------------------
export interface LeaveStatusProps {
  name: string;
  leaveType: string;
  dates: string;
  status: string;
  remarks?: string;
}

export const LeaveStatusEmail: React.FC<LeaveStatusProps> = ({ name, leaveType, dates, status, remarks }) => {
  const isApproved = status.toUpperCase() === 'APPROVED';
  return (
    <EmailLayout previewText={`Leave request has been ${status.toLowerCase()}`} title="Leave Application Update">
      <Text style={bodyText}>
        Hello {name},
      </Text>
      <Text style={bodyText}>
        Your leave application has been reviewed:
      </Text>
      <Section style={card}>
        <Text style={{ margin: '4px 0', fontSize: '16px' }}>
          Leave Type: <strong>{leaveType}</strong>
        </Text>
        <Text style={{ margin: '4px 0', fontSize: '16px' }}>
          Dates: <strong>{dates}</strong>
        </Text>
        <Text style={{ margin: '4px 0', fontSize: '16px' }}>
          Status: <strong style={{ color: isApproved ? '#2e7d32' : '#d32f2f' }}>{status.toUpperCase()}</strong>
        </Text>
        {remarks && (
          <Text style={{ margin: '8px 0 4px 0', fontSize: '14px', fontStyle: 'italic' }}>
            Approver Remarks: "{remarks}"
          </Text>
        )}
      </Section>
    </EmailLayout>
  );
};

export const getLeaveStatusText = (name: string, leaveType: string, dates: string, status: string, remarks?: string): string => `
NEXGEN PHARMA EMS
Leave Application Update

Hello ${name},

Your leave application has been reviewed:

Leave Type: ${leaveType}
Dates: ${dates}
Status: ${status.toUpperCase()}
${remarks ? `Remarks: "${remarks}"` : ''}

NexGen Pharma Solutions Pvt. Ltd.
`;

// -------------------------------------------------------------
// 8. Salary Slip Alert
// -------------------------------------------------------------
export interface SalarySlipAlertProps {
  name: string;
  period: string;
  netPayable: number;
  status: string;
  details?: {
    paymentRef?: string;
    signatureName?: string;
  };
}

export const SalarySlipAlertEmail: React.FC<SalarySlipAlertProps> = ({ name, period, netPayable, status, details }) => {
  const isTransferred = status.toUpperCase() === 'TRANSFERRED';
  return (
    <EmailLayout previewText={`Salary Slip for ${period} ${status.toLowerCase()}`} title="Salary Details">
      <Text style={bodyText}>
        Hello {name},
      </Text>
      <Text style={bodyText}>
        Your salary slip and details for <strong>{period}</strong> have been updated:
      </Text>
      <Section style={card}>
        <Text style={{ margin: '4px 0', fontSize: '16px' }}>
          Period: <strong>{period}</strong>
        </Text>
        <Text style={{ margin: '4px 0', fontSize: '16px' }}>
          Net Payable: <strong>₹{netPayable.toFixed(2)}</strong>
        </Text>
        <Text style={{ margin: '4px 0', fontSize: '16px' }}>
          Status: <strong style={{ color: isTransferred ? '#2e7d32' : '#f5c518' }}>{status.toUpperCase()}</strong>
        </Text>
        {details?.paymentRef && (
          <Text style={{ margin: '4px 0', fontSize: '14px' }}>
            Payment Reference: <strong>{details.paymentRef}</strong>
          </Text>
        )}
        {details?.signatureName && (
          <Text style={{ margin: '4px 0', fontSize: '14px' }}>
            Approved By: <strong>{details.signatureName}</strong>
          </Text>
        )}
      </Section>
      <Text style={bodyText}>
        Please log into the portal to download the complete PDF salary slip.
      </Text>
    </EmailLayout>
  );
};

export const getSalarySlipAlertText = (name: string, period: string, netPayable: number, status: string, details?: any): string => `
NEXGEN PHARMA EMS
Salary Details

Hello ${name},

Your salary slip and details for ${period} have been updated:

Period: ${period}
Net Payable: ₹${netPayable.toFixed(2)}
Status: ${status.toUpperCase()}
${details?.paymentRef ? `Payment Reference: ${details.paymentRef}` : ''}
${details?.signatureName ? `Approved By: ${details.signatureName}` : ''}

Please log into the portal to download the complete PDF salary slip.

NexGen Pharma Solutions Pvt. Ltd.
`;

// -------------------------------------------------------------
// 9. Admin Missing Punch Summary
// -------------------------------------------------------------
export interface AdminMissingPunchSummaryProps {
  date: string;
  employees: Array<{ name: string; department: string }>;
}

export const AdminMissingPunchSummaryEmail: React.FC<AdminMissingPunchSummaryProps> = ({ date, employees }) => {
  return (
    <EmailLayout previewText={`Daily missing punch summary for ${date}`} title="Missing Punch Daily Summary">
      <Text style={bodyText}>
        Hello Administrator,
      </Text>
      <Text style={bodyText}>
        Here is the summary of employees who had a <strong>missing punch out</strong> on <strong>{date}</strong>:
      </Text>
      <Section style={card}>
        {employees.length === 0 ? (
          <Text style={{ margin: '4px 0', fontStyle: 'italic' }}>No missing punches detected.</Text>
        ) : (
          employees.map((emp, i) => (
            <div key={i} style={{ borderBottom: i < employees.length - 1 ? '1px solid #eeeeee' : 'none', padding: '8px 0' }}>
              <Text style={{ margin: '0', fontSize: '15px' }}>
                <strong>{emp.name}</strong> — {emp.department}
              </Text>
            </div>
          ))
        )}
      </Section>
      <Text style={bodyText}>
        NexGen EMS system will prompt these employees to complete corrections.
      </Text>
    </EmailLayout>
  );
};

export const getAdminMissingPunchSummaryText = (date: string, employees: Array<{ name: string; department: string }>): string => `
NEXGEN PHARMA EMS
Missing Punch Daily Summary

Hello Administrator,

Here is the summary of employees who had a missing punch out on ${date}:

${employees.length === 0 ? 'No missing punches detected.' : employees.map(emp => `- ${emp.name} (${emp.department})`).join('\n')}

NexGen EMS system will prompt these employees to complete corrections.

NexGen Pharma Solutions Pvt. Ltd.
`;

// Styles
const bodyText = {
  fontSize: '15px',
  color: '#1a1a1a',
  margin: '12px 0',
  lineHeight: '1.5',
};

const card = {
  backgroundColor: '#fffdf5',
  border: '3px solid #1a1a1a',
  boxShadow: '4px 4px 0px #1a1a1a',
  padding: '20px',
  margin: '20px 0',
};

const otpHeading = {
  color: '#1a1a1a',
  fontSize: '36px',
  fontWeight: 'bold',
  letterSpacing: '4px',
  margin: 0,
  textAlign: 'center' as const,
};

const btn = {
  backgroundColor: '#1a1a1a',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold',
  textTransform: 'uppercase' as const,
  padding: '12px 24px',
  borderRadius: '0',
  textDecoration: 'none',
  border: '3px solid #1a1a1a',
  boxShadow: '4px 4px 0px #f5c518',
  display: 'inline-block',
};

const codeText = {
  fontSize: '13px',
  backgroundColor: '#eeeeee',
  padding: '8px',
  border: '1px solid #cccccc',
  fontFamily: 'monospace',
  wordBreak: 'break-all' as const,
};

const codeStyle = {
  fontSize: '13px',
  backgroundColor: '#eeeeee',
  padding: '8px',
  border: '1px solid #cccccc',
  fontFamily: 'monospace',
  wordBreak: 'break-all' as const,
};
