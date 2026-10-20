export class EmailNotConfiguredError extends Error {
  readonly code = 'EMAIL_NOT_CONFIGURED';

  constructor(message = 'El envío de correo no está configurado.') {
    super(message);
    this.name = 'EmailNotConfiguredError';
  }
}
