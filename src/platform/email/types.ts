export type EmailAttachment = Readonly<{
  filename: string;
  content: Buffer;
  contentType: string;
}>;

export type EmailMessage = Readonly<{
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: readonly EmailAttachment[];
}>;

export type EmailSendResult = Readonly<{
  messageId: string;
}>;

export interface EmailTransport {
  send(message: EmailMessage): Promise<EmailSendResult>;
  verifyConnection?(): Promise<void>;
}
