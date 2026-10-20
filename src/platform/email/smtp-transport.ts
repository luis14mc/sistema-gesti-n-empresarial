import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailMessage, EmailSendResult, EmailTransport } from './types';
import type { SmtpRuntimeConfig } from './smtp-config';

const CONNECTION_TIMEOUT_MS = 10_000;
const SEND_TIMEOUT_MS = 30_000;

export class SmtpTransport implements EmailTransport {
  private readonly transporter: Transporter;

  constructor(private readonly config: SmtpRuntimeConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASSWORD,
      },
      pool: true,
      maxConnections: 5,
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      greetingTimeout: CONNECTION_TIMEOUT_MS,
      socketTimeout: SEND_TIMEOUT_MS,
    });
  }

  async verifyConnection(): Promise<void> {
    await this.transporter.verify();
  }

  async close(): Promise<void> {
    this.transporter.close();
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const result = await this.transporter.sendMail({
      from: this.config.SMTP_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo ?? this.config.SMTP_REPLY_TO,
      attachments: message.attachments?.map((file) => ({
        filename: file.filename,
        content: file.content,
        contentType: file.contentType,
      })),
    });
    return { messageId: String(result.messageId ?? '') };
  }
}
