/* Tema (claro/oscuro) y atajo de la barra (Carnet).
   Se carga en <head> sin defer para que el tema se aplique antes de pintar. */
(() => {
  const root = document.documentElement, KEY = 'saphix.ui';
  let theme = 'dark';
  try { if (JSON.parse(localStorage.getItem(KEY) || '{}').theme === 'light') theme = 'light'; } catch (e) {}
  root.dataset.theme = theme;

  addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id), t = $('bTheme');
    const sync = () => {
      const light = theme === 'light';
      t.setAttribute('aria-checked', light);
      t.title = light ? 'Modo claro activado (clic para modo oscuro)' : 'Modo oscuro activado (clic para modo claro)';
    };
    t.onclick = () => {
      theme = theme === 'dark' ? 'light' : 'dark'; root.dataset.theme = theme; sync();
      try { localStorage.setItem(KEY, JSON.stringify({ theme })); } catch (e) {}
    };
    sync();

    // Carnet: abre la ventana (js/carnet.js)
    $('tCarnet').onclick = () => { if (window.App && App.openCarnet) App.openCarnet(); };
  });
})();
