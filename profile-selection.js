// Staff can still switch player views, but their own linked player is now the default.
const electricalOpenLoad = load;
load = async function () {
  await electricalOpenLoad();
  const linkedPlayer = state.memberDirectory.find(item => item.profile_id === session?.user?.id);
  if (!linkedPlayer || state.selectedPlayerId === linkedPlayer.id) return;
  state.selectedPlayerId = linkedPlayer.id;
  document.querySelector('#player-select').value = linkedPlayer.id;
  render();
};
