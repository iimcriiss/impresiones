/* Estado compartido y utilidades */
(() => {
  const App = window.App = {};
  App.$ = id => document.getElementById(id);
  App.PAPER = { a4:[210,297], carta:[215.9,279.4], oficio:[215.9,330.2], a5:[148,210], f10:[102,152], f13:[127,178] };
  // Medidas en mm. manual = true cuando el usuario movió algo a mano.
  App.S = { paper:'a4', orient:'p', margin:10, gap:5, cols:2, rows:2, fit:'contain', snap:true, zoom:100,
            W:210, H:297, items:[], sel:null, manual:false, uid:0 };
  App.byId = id => App.S.items.find(i => i.id === id);
  App.dims = () => {
    const S = App.S, [a, b] = App.PAPER[S.paper];
    S.W = S.orient === 'l' ? b : a;
    S.H = S.orient === 'l' ? a : b;
  };
})();
