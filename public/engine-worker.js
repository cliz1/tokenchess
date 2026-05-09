let engine = null;
let queue = [];

self.onmessage = (e) => {
  if (engine) {
    engine.postMessage(e.data);
  } else {
    queue.push(e.data);
  }
};

self.addEventListener('unhandledrejection', (e) => {
  console.error("Worker unhandled rejection:", e.reason);
});

console.log("engine-worker: SharedArrayBuffer available:", typeof SharedArrayBuffer);
console.log("engine-worker: calling importScripts");
importScripts("/stockfish.js");
console.log("engine-worker: importScripts done, Stockfish:", typeof Stockfish);

fetch("/variants.ini")
  .then((r) => r.text())
  .then((ini) => {
    return Stockfish({
  mainScriptUrlOrBlob: "/stockfish.js",
  locateFile: (file) => file.endsWith(".wasm") ? "/stockfish-wasm" : `/${file}`,
  preRun: [(sf) => {
    sf.FS.writeFile("/variants.ini", ini);
  }],
}).then((sf) => {
  engine = sf;
  sf.addMessageListener((line) => {
    self.postMessage(line);
  });
  sf.postMessage("setoption name VariantPath value /variants.ini");
  queue.forEach((cmd) => sf.postMessage(cmd));
  queue = [];
}).catch((err) => {
  throw new Error("Stockfish init failed: " + err);
});
  });