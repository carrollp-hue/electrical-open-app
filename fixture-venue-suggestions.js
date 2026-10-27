(() => {
  const addVenueSuggestions = () => {
    const input = document.querySelector('#add-fixture-form input[name="name"]');
    if (!input || input.dataset.venueSuggestionsReady) return;
    input.dataset.venueSuggestionsReady = 'true';
    const names = [...new Map((state.fixtures || [])
      .map(fixture => `${fixture.name || ''}`.trim())
      .filter(name => name && !/^\d/.test(name))
      .map(name => [name.toLocaleLowerCase(), name])).values()]
      .sort((first, second) => first.localeCompare(second));
    const list = document.createElement('datalist');
    list.id = 'fixture-venue-suggestions';
    list.innerHTML = names.map(name => `<option value="${esc(name)}"></option>`).join('');
    input.insertAdjacentElement('afterend', list);
    input.setAttribute('list', list.id);
    input.setAttribute('autocomplete', 'off');
    input.placeholder = 'Start typing a previous venue';
  };

  new MutationObserver(addVenueSuggestions).observe(document.querySelector('#app'), { childList: true, subtree: true });
  addVenueSuggestions();
})();
