import { describe, expect, it, vi } from 'vitest';
import { SSEStreamer } from '../src/server/SSEStreamer.js';

describe('SSEStreamer', () => {
  it('broadcasts task updates and closes terminal streams', () => {
    const streamer = new SSEStreamer();
    const end = vi.fn();
    const write = vi.fn();
    const response = {
      writeHead: vi.fn(),
      write,
      end,
      on: vi.fn(),
    };

    streamer.addClient('task-1', response as never);
    streamer.sendTaskUpdate('task-1', {
      id: 'task-1',
      status: { state: 'completed', timestamp: new Date().toISOString() },
      history: [],
    });

    expect(write).toHaveBeenCalled();
    expect(end).toHaveBeenCalled();
  });

  it('removes clients that fail during writes and ignores missing streams', () => {
    const streamer = new SSEStreamer();
    const stableResponse = {
      writeHead: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
    };
    const failingResponse = {
      writeHead: vi.fn(),
      write: vi.fn(() => {
        throw new Error('socket closed');
      }),
      end: vi.fn(),
      on: vi.fn(),
    };

    streamer.sendEvent('missing-task', 'task_updated', { ok: true });
    streamer.addClient('task-2', stableResponse as never);
    streamer.addClient('task-2', failingResponse as never);
    streamer.sendEvent('task-2', 'task_updated', { ok: true });
    streamer.removeClient('task-2', stableResponse as never);
    streamer.closeStream('task-2');

    expect(stableResponse.write).toHaveBeenCalledTimes(1);
    expect(failingResponse.write).toHaveBeenCalledTimes(1);
    expect(stableResponse.end).not.toHaveBeenCalled();
  });
});
