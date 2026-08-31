(() => {
  const applicationRender = render;

  // Optional display modules refresh their views after loading.  Before a
  // session has been established those refreshes must never replace the login
  // form with a member or detail view.
  render = function () {
    if (!session) {
      login();
      return;
    }
    applicationRender();
  };
})();
