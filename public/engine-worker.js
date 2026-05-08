let engine = null;
let queue = [];

self.onmessage = (e) => {
  if (engine) {
    engine.postMessage(e.data);
  } else {
    queue.push(e.data);
  }
};

importScripts("/stockfish.js");

fetch("/variants.ini")
  .then((r) => r.text())
  .then((ini) => {
    return Stockfish({
  mainScriptUrlOrBlob: "/stockfish.js",
  locateFile: (file) => file.endsWith(".wasm")
    ? "https://github.com/cliz1/tokenchess/releases/download/v1.0-assets/stockfish.wasm"
    : `/${file}`,
  preRun: [(sf) => {
    sf.FS.writeFile("/variants.ini", ini);
  }],
}).then((sf) => {
  engine = sf;
  sf.addMessageListener((line) => {
    self.postMessage(line);
  });
  // send VariantPath FIRST before queued commands
  sf.postMessage("setoption name VariantPath value /variants.ini");
  queue.forEach((cmd) => sf.postMessage(cmd));
  queue = [];
});
  });