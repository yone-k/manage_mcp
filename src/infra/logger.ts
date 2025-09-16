import type { Logger } from '../types/index.js';

export const createLogger = (verbose: boolean): Logger => {
  const formatMessage = (level: string, message: string): string => `[${level}] ${message}`;

  return {
    debug: (message: string): void => {
      if (verbose) {
        console.log(formatMessage('DEBUG', message));
      }
    },

    info: (message: string): void => {
      console.log(formatMessage('INFO', message));
    },

    warn: (message: string): void => {
      console.warn(formatMessage('WARN', message));
    },

    error: (message: string): void => {
      console.error(formatMessage('ERROR', message));
    }
  };
};