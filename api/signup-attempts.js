function createSignupAttemptStore(limit = 100) {
  const attempts = [];

  return {
    record(entry) {
      const attempt = {
        ...entry,
        timestamp: entry.timestamp || new Date().toISOString()
      };

      attempts.unshift(attempt);

      if (attempts.length > limit) {
        attempts.length = limit;
      }

      return attempt;
    },
    list() {
      return attempts.slice();
    }
  };
}

module.exports = { createSignupAttemptStore };
