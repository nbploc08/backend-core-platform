import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailsService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_APP_PASSWORD, // app password
      },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    return this.transporter.sendMail({
      from: `"TEAM" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html,
    });
  }

  async sendVerifyCode(email: string, code: string) {
    const verifyUrl = `http://localhost:3001/auth/register/verify?email=${email}&code=${encodeURIComponent(code)}`;
    return this.sendMail(
      email,
      'Your verification code',
      `
        <h2>Verify your account</h2>
        <p>Your verification link:</p>
        <h1><a href="${verifyUrl}">http://localhost:3001/auth/register/verify?email=${email}&code=${code}</a></h1>
        <p>This code will expire in 5 minutes.</p>
      `,
    );
  }
}
