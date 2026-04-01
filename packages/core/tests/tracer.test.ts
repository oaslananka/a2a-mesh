import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockBaggage {
  entries: Record<string, unknown>;
  setEntry: (key: string, value: unknown) => MockBaggage;
}

function createMockBaggage(entries: Record<string, unknown> = {}): MockBaggage {
  return {
    entries,
    setEntry(key: string, value: unknown) {
      return createMockBaggage({
        ...entries,
        [key]: value,
      });
    },
  };
}

vi.mock('@opentelemetry/api', () => {
  const getBaggage = vi.fn();
  const createBaggage = vi.fn(() => createMockBaggage());
  const setBaggage = vi.fn((activeContext: unknown, baggage: unknown) => ({
    activeContext,
    baggage,
  }));
  const active = vi.fn(() => 'active-context');
  const withContext = vi.fn((nextContext: unknown, callback: () => void) => {
    callback();
    return nextContext;
  });
  const getTracer = vi.fn((name: string, version: string) => ({ name, version }));

  return {
    SpanStatusCode: {
      OK: 'OK',
      ERROR: 'ERROR',
    },
    baggageEntryMetadataFromString: vi.fn((value: string) => ({ value })),
    context: {
      active,
      with: withContext,
    },
    propagation: {
      getBaggage,
      createBaggage,
      setBaggage,
    },
    trace: {
      getTracer,
    },
  };
});

import { baggageEntryMetadataFromString, context, propagation, trace } from '@opentelemetry/api';
import { SpanStatusCode, a2aMeshTracer, withA2ABaggage } from '../src/telemetry/tracer.js';

describe('tracer helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates baggage entries for task and context ids', () => {
    vi.mocked(propagation.getBaggage).mockReturnValue(undefined);

    withA2ABaggage('task-1', 'ctx-1');

    expect(propagation.createBaggage).toHaveBeenCalledWith({});
    expect(baggageEntryMetadataFromString).toHaveBeenCalledWith('a2a');
    expect(propagation.setBaggage).toHaveBeenCalledWith(
      'active-context',
      expect.objectContaining({
        entries: expect.objectContaining({
          'a2a.task_id': expect.objectContaining({ value: 'task-1' }),
          'a2a.context_id': expect.objectContaining({ value: 'ctx-1' }),
        }),
      }),
    );
    expect(context.with).toHaveBeenCalled();
  });

  it('reuses existing baggage when no ids are provided', () => {
    const existingBaggage = createMockBaggage({
      persisted: { value: 'yes' },
    });
    vi.mocked(propagation.getBaggage).mockReturnValue(existingBaggage);

    withA2ABaggage();

    expect(propagation.createBaggage).not.toHaveBeenCalled();
    expect(propagation.setBaggage).toHaveBeenCalledWith('active-context', existingBaggage);
  });

  it('exports the tracer instance and span status codes', () => {
    expect(typeof trace.getTracer).toBe('function');
    expect(a2aMeshTracer).toEqual({ name: 'a2a-mesh', version: '1.0.0' });
    expect(SpanStatusCode.OK).toBe('OK');
    expect(SpanStatusCode.ERROR).toBe('ERROR');
  });
});
