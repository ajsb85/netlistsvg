// demo-tabs.js — input-panel tabs: the editable Yosys JSON, plus read-only views of
// the payload SENT to the elk-rust WASM (the ELK graph + layout options) and the
// payload RECEIVED back (the laid-out graph). elk-wasm-browser.js stashes the last
// request/response on `window.__elkIO` and fires an `elk-io` event after each layout.
(() => {
  const tabbar = document.getElementById('inputTabs');
  const views = {
    editor: document.getElementById('editor'),
    request: document.getElementById('wasmRequest'),
    response: document.getElementById('wasmResponse'),
  };
  if (!tabbar || !views.editor) return;

  function activate(name) {
    for (const btn of tabbar.querySelectorAll('.tab')) {
      const on = btn.dataset.tab === name;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    for (const [key, el] of Object.entries(views)) el.hidden = key !== name;
  }

  tabbar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (btn) activate(btn.dataset.tab);
  });

  const render = (value, empty) =>
    value == null ? empty : JSON.stringify(value, null, 2);

  window.addEventListener('elk-io', () => {
    const io = window.__elkIO || {};
    views.request.value = render(
      io.request,
      '— render a schematic to see the payload sent to the WASM —',
    );
    views.response.value = render(
      io.response,
      '— render a schematic to see the payload returned by the WASM —',
    );
  });
})();
