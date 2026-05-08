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
    console.log("variants.ini content:", ini.slice(0, 300));
    return Stockfish({
  mainScriptUrlOrBlob: "/stockfish.js",
  locateFile: (file) => "/" + file,
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