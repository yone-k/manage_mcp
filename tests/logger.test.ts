import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogger } from '../src/infra/logger.js';

// Mock console
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

vi.stubGlobal('console', mockConsole);

describe('createLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with verbose=false', () => {
    const logger = createLogger(false);

    it('should not log debug messages', () => {
      logger.debug('test debug message');
      expect(mockConsole.log).not.toHaveBeenCalled();
    });

    it('should log info messages', () => {
      logger.info('test info message');
      expect(mockConsole.log).toHaveBeenCalledWith('[INFO] test info message');
    });

    it('should log warn messages', () => {
      logger.warn('test warn message');
      expect(mockConsole.warn).toHaveBeenCalledWith('[WARN] test warn message');
    });

    it('should log error messages', () => {
      logger.error('test error message');
      expect(mockConsole.error).toHaveBeenCalledWith('[ERROR] test error message');
    });
  });

  describe('with verbose=true', () => {
    const logger = createLogger(true);

    it('should log debug messages', () => {
      logger.debug('test debug message');
      expect(mockConsole.log).toHaveBeenCalledWith('[DEBUG] test debug message');
    });

    it('should log info messages', () => {
      logger.info('test info message');
      expect(mockConsole.log).toHaveBeenCalledWith('[INFO] test info message');
    });

    it('should log warn messages', () => {
      logger.warn('test warn message');
      expect(mockConsole.warn).toHaveBeenCalledWith('[WARN] test warn message');
    });

    it('should log error messages', () => {
      logger.error('test error message');
      expect(mockConsole.error).toHaveBeenCalledWith('[ERROR] test error message');
    });
  });

  describe('message formatting', () => {
    const logger = createLogger(true);

    it('should handle empty messages', () => {
      logger.info('');
      expect(mockConsole.log).toHaveBeenCalledWith('[INFO] ');
    });

    it('should handle multiline messages', () => {
      logger.info('line1\nline2');
      expect(mockConsole.log).toHaveBeenCalledWith('[INFO] line1\nline2');
    });

    it('should handle messages with special characters', () => {
      logger.info('message with "quotes" and símb©ls');
      expect(mockConsole.log).toHaveBeenCalledWith('[INFO] message with "quotes" and símb©ls');
    });
  });
});