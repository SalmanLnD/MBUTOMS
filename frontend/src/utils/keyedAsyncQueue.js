/** Serialize writes to the same resource without blocking unrelated resources. */
export const createKeyedAsyncQueue = () => {
  const pending = new Map();
  return {
    has: (key) => pending.has(key),
    run(key, task) {
      const previous = pending.get(key);
      const work = (previous ? previous.catch(() => {}) : Promise.resolve()).then(task);
      const result = work.finally(() => {
        if (pending.get(key) === result) pending.delete(key);
      });
      pending.set(key, result);
      return result;
    },
  };
};
