import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailsService {
  private readonly transporter: nodemailer.Transporter;
  private readonly mailUser: string;

  constructor() {
    const mailUser = process.env.MAIL_USER?.trim();
    const mailAppPassword = process.env.MAIL_APP_PASSWORD?.trim();
    if (!mailUser || !mailAppPassword) {
      const missing = [!mailUser && 'MAIL_USER', !mailAppPassword && 'MAIL_APP_PASSWORD'].filter(
        Boolean,
      );
      throw new Error(
        `MailsService: Missing required env: ${missing.join(', ')}. Set them in .env`,
      );
    }
    this.mailUser = mailUser;
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: mailUser,
        pass: mailAppPassword,
      },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    return this.transporter.sendMail({
      from: `"TEAM" <${this.mailUser}>`,
      to,
      subject,
      html,
    });
  }

  async sendVerifyCode(email: string, code: string) {
    const baseUrl = process.env.VERIFY_LINK_BASE_URL || 'http://localhost:3001';
    // Link trỏ tới trang confirm → form auto-submit POST /auth/register/verify
    const verifyUrl = `${baseUrl}/auth/register/verify/confirm?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;
    return this.sendMail(
      email,
      'Your verification code',
      `
        <h2>Verify your account</h2>
        <p>Click the link below to verify (we will send a POST request for you):</p>
        <p><a href="${verifyUrl}">Verify my email</a></p>
        <p>This link will expire in 15 minutes.</p>
      `,
    );
  }
  async sendResetPassword(email: string, token: string) {
    const baseUrl = process.env.VERIFY_LINK_BASE_URL || 'http://localhost:3001';
    const resetPasswordUrl = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
    return this.sendMail(
      email,
      'Reset your password',
      `Click the link below to reset your password: ${resetPasswordUrl}`,
    );
  }
}
