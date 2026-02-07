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
      const missing = [
        !mailUser && 'MAIL_USER',
        !mailAppPassword && 'MAIL_APP_PASSWORD',
      ].filter(Boolean);
      throw new Error(
        `MailsService: Missing required env: ${missing.join(', ')}. Set them in .env`,
      );
    }
    this.mailUser = mailUser;
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
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
    const verifyUrl = `${baseUrl}/auth/register/verify?email=${email}&code=${encodeURIComponent(code)}`;
    return this.sendMail(
      email,
      'Your verification code',
      `
        <h2>Verify your account</h2>
        <p>Your verification link:</p>
        <h1><a href="${verifyUrl}">${verifyUrl}</a></h1>
        <p>This code will expire in 5 minutes.</p>
      `,
    );
  }
}
