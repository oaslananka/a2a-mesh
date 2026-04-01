import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../src/utils/logger.js';

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.NODE_ENV;
    delete process.env.LOG_LEVEL;
  });

  it('writes structured JSON in production mode', () => {
    process.env.NODE_ENV = 'production';
    const spy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    logger.info('hello', { taskId: 'task-1' });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('"taskId":"task-1"'));
  });

  it('respects log level filtering', () => {
    process.env.LOG_LEVEL = 'error';
    const spy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    logger.info('skip me');
    expect(spy).not.toHaveBeenCalled();
  });

  it('writes to stderr for error logs', () => {
    const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    logger.error('boom', { error: new Error('broken') });
    expect(spy).toHaveBeenCalled();
  });
});
