const scene = new URLSearchParams(location.search).get('asset') ?? 'hero';
document.documentElement.dataset.asset = scene;
document.querySelectorAll('[data-scene]').forEach((element) => {
  element.hidden = element.dataset.scene !== scene;
});
