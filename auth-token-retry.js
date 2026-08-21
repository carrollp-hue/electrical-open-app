(() => {
  const initialLoad = load;
  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  const isTemporaryJwtTimingError = error => /jwt.*(issued.*future|not active)|issued.*future.*jwt/i.test(String(error?.message || error));

  load = async function () {
    try {
      return await initialLoad();
    } catch (error) {
      if (!isTemporaryJwtTimingError(error)) throw error;
      // Auth and database servers can occasionally disagree by a second when a
      // new token is created. Keep the session and retry the initial data load.
      await wait(2000);
      return initialLoad();
    }
  };
})();
