import { MailService } from '@sendgrid/mail';
import { log } from "../vite";

// Initialize SendGrid if API key is available
let mailService: MailService | null = null;

if (process.env.SENDGRID_API_KEY) {
  mailService = new MailService();
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
  log("SendGrid initialized successfully", "email");
} else {
  log("SENDGRID_API_KEY not found in environment variables. Email functionality will be disabled.", "email");
}

export interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    if (!mailService) {
      log("Email sending failed: SendGrid not initialized", "email");
      return false;
    }

    const defaultSender = 'noreply@ieltsexam.com';
    
    await mailService.send({
      to: params.to,
      from: params.from ? params.from : defaultSender, // Use default sender if not provided
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    
    log(`Email sent successfully to ${params.to}`, "email");
    return true;
  } catch (error) {
    log(`SendGrid email error: ${error instanceof Error ? error.message : String(error)}`, "email");
    return false;
  }
}

// Generate a random OTP
export function generateOTP(length: number = 6): string {
  const digits = '0123456789';
  let otp = '';
  
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  
  return otp;
}

// Email templates
export const emailTemplates = {
  verification: (otp: string) => ({
    subject: 'IELTS Exam - Verify Your Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #3b82f6;">IELTS Exam Platform</h1>
        </div>
        <div style="padding: 20px; background-color: #f9fafb; border-radius: 5px;">
          <h2 style="margin-top: 0;">Verify Your Email Address</h2>
          <p>Thank you for registering with IELTS Exam Platform. To complete your registration, please use the following verification code:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="font-size: 24px; font-weight: bold; letter-spacing: 8px; padding: 15px; background-color: #e5e7eb; border-radius: 5px; display: inline-block;">
              ${otp}
            </div>
          </div>
          <p>This verification code will expire in 60 seconds.</p>
          <p>If you did not create an account, you can safely ignore this email.</p>
        </div>
        <div style="margin-top: 20px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} IELTS Exam Platform. All rights reserved.</p>
        </div>
      </div>
    `,
    text: `Verify Your Email Address

Thank you for registering with IELTS Exam Platform. To complete your registration, please use the following verification code:

${otp}

This verification code will expire in 60 seconds.

If you did not create an account, you can safely ignore this email.`,
  }),
  
  passwordReset: (otp: string) => ({
    subject: 'IELTS Exam - Password Reset',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #3b82f6;">IELTS Exam Platform</h1>
        </div>
        <div style="padding: 20px; background-color: #f9fafb; border-radius: 5px;">
          <h2 style="margin-top: 0;">Password Reset Request</h2>
          <p>We received a request to reset your password. Please use the following code to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="font-size: 24px; font-weight: bold; letter-spacing: 8px; padding: 15px; background-color: #e5e7eb; border-radius: 5px; display: inline-block;">
              ${otp}
            </div>
          </div>
          <p>This code will expire in 60 seconds.</p>
          <p>If you did not request a password reset, you can safely ignore this email.</p>
        </div>
        <div style="margin-top: 20px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} IELTS Exam Platform. All rights reserved.</p>
        </div>
      </div>
    `,
    text: `Password Reset Request

We received a request to reset your password. Please use the following code to reset your password:

${otp}

This code will expire in 60 seconds.

If you did not request a password reset, you can safely ignore this email.`,
  }),
};