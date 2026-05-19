import { Resend } from 'resend';

export const createResendClient = (apiKey: string) => {
  return new Resend(apiKey);
};
