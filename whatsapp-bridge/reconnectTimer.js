export const createReconnectTimer = ({ setTimer = setTimeout, clearTimer = clearTimeout } = {}) => {
  let timer = null;
  let generation = 0;
  return {
    get pending() { return timer !== null; },
    schedule(callback, delay) {
      if (timer !== null) return;
      const scheduledGeneration = ++generation;
      timer = setTimer(() => {
        if (scheduledGeneration !== generation) return;
        timer = null;
        callback();
      }, delay);
    },
    cancel() {
      generation += 1;
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
  };
};
