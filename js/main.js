/* Arranque */
(() => {
  const App = window.App;
  App.dims();
  App.render();
  addEventListener('resize', App.render);
})();
