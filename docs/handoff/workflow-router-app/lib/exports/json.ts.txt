export const toJson = (x: unknown) => JSON.stringify({ schema: 'semester.workflow-router/1', exportedAt: new Date().toISOString(), data: x }, null, 2) + '\n';
