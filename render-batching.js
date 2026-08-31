(() => {
  const composedRender = render;
  const composedLoad = load;
  let loadingDepth = 0;
  let redrawPending = false;

  // Feature modules enrich the same state in sequence.  They previously each
  // called render(), which made the screen visibly redraw as data arrived.
  // Defer those intermediate paints and show the completed view once.
  render = function () {
    if (loadingDepth > 0) {
      redrawPending = true;
      return;
    }
    composedRender();
  };

  load = async function () {
    loadingDepth += 1;
    let completed = false;
    try {
      const result = await composedLoad();
      completed = true;
      return result;
    } finally {
      loadingDepth -= 1;
      if (loadingDepth === 0 && completed && redrawPending) {
        redrawPending = false;
        render();
      }
    }
  };
})();
