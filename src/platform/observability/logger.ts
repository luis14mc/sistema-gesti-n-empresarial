export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Readonly<Record<string, unknown>>;

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(context: LogContext): Logger;
}

type LogRecord = LogContext & {
  timestamp: string;
  level: LogLevel;
  message: string;
};

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function configuredLogLevel(): LogLevel {
  const value = process.env.LOG_LEVEL;
  return value === 'debug' || value === 'warn' || value === 'error' ? value : 'info';
}

function write(level: LogLevel, record: LogRecord): void {
  if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[configuredLogLevel()]) return;
  const serialized = JSON.stringify(record, (_key, value: unknown) => {
    if (value instanceof Error) {
      return { name: value.name, message: value.message, stack: value.stack };
    }
    return typeof value === 'bigint' ? value.toString() : value;
  });

  console[level](serialized);
}

export function createLogger(baseContext: LogContext = {}): Logger {
  const log = (level: LogLevel, message: string, context: LogContext = {}): void => {
    write(level, {
      ...baseContext,
      ...context,
      timestamp: new Date().toISOString(),
      level,
      message,
    });
  };

  return {
    debug: (message, context) => log('debug', message, context),
    info: (message, context) => log('info', message, context),
    warn: (message, context) => log('warn', message, context),
    error: (message, context) => log('error', message, context),
    child: (context) => createLogger({ ...baseContext, ...context }),
  };
}

export const logger: Logger = createLogger();
