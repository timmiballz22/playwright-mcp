// Shared declarative tool contract. Runtime validation remains authoritative.
export const workflowInputSchema = {
      type: 'object',
      additionalProperties: false,
      required: ['steps'],
      properties: {
        schemaVersion: { type: 'integer', enum: [1] },
        browser: { type: 'string', enum: ['chromium', 'firefox', 'webkit'] },
        iterations: { type: 'integer', minimum: 1, maximum: 100 },
        timeoutMs: { type: 'integer', minimum: 100, maximum: 180000 },
        actionTimeoutMs: { type: 'integer', minimum: 100, maximum: 30000 },
        steps: {
          type: 'array', minItems: 1, maxItems: 1000,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['type'],
            properties: {
              type: { type: 'string', enum: ['goto','click','fill','press','check',
                'uncheck','hover','waitFor','assertText','assertURL','scroll','screenshot'] },
              repeat: { type: 'integer', minimum: 1, maximum: 1000 },
              url: { type: 'string' }, selector: { oneOf: [
                { type: 'string', minLength: 1, maxLength: 500 },
                { type: 'object', additionalProperties: false, required: ['role', 'name'], properties: { role: { type: 'string', minLength: 1, maxLength: 100 }, name: { type: 'string', minLength: 1, maxLength: 500 } } },
                ...['testId', 'label', 'placeholder', 'text'].map(key => ({ type: 'object', additionalProperties: false, required: [key], properties: { [key]: { type: 'string', minLength: 1, maxLength: 500 } } })),
              ] },
              value: { type: 'string' }, key: { type: 'string' },
              contains: { type: 'string' }, equals: { type: 'string', maxLength: 2000 },
              deltaX: { type: 'integer' }, deltaY: { type: 'integer' },
            },
          },
        },
      },
    };
