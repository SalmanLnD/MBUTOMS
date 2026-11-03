// Writes may have succeeded even when the response is lost.
export const isSafeRetryMethod = (method) => ['get', 'head', 'options'].includes(String(method || 'get').toLowerCase());
