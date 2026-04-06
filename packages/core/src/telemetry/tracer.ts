/**
 * @file tracer.ts
 * OpenTelemetry helpers for the A2A runtime.
 */

import {
  SpanStatusCode,
  baggageEntryMetadataFromString,
  context,
  propagation,
  trace,
} from '@opentelemetry/api';

const VERSION = '1.0.0';

export const a2aMeshTracer = trace.getTracer('a2a-mesh', VERSION);

export function withA2ABaggage(taskId?: string, contextId?: string): void {
  let currentBaggage = propagation.getBaggage(context.active()) ?? propagation.createBaggage({});

  if (taskId) {
    currentBaggage = currentBaggage.setEntry('a2a.task_id', {
      value: taskId,
      metadata: baggageEntryMetadataFromString('a2a'),
    });
  }

  if (contextId) {
    currentBaggage = currentBaggage.setEntry('a2a.context_id', {
      value: contextId,
      metadata: baggageEntryMetadataFromString('a2a'),
    });
  }

  const nextContext = propagation.setBaggage(context.active(), currentBaggage);
  context.with(nextContext, () => undefined);
}

export { SpanStatusCode };
