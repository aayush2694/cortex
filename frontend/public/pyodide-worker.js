// Runs Python in the browser with Pyodide (CPython compiled to WebAssembly).
// A module worker (started with {type: 'module'}) that imports Pyodide's ES module build.
// It lives in a Web Worker so a slow or endless solution never freezes the page: the main
// thread can simply terminate this worker. Nothing here ever reaches the Cortex server.
//
// Messages in:  {type: 'init', harness}            -> {type: 'ready', version}
//               {type: 'run', id, payload (JSON)}  -> {type: 'result', id, result (JSON)}
// Errors:       {type: 'error', id?, message}

const PYODIDE_VERSION = '314.0.7';
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let runCasesJson = null;

self.onmessage = async (event) => {
  const msg = event.data;
  try {
    if (msg.type === 'init') {
      const { loadPyodide } = await import(PYODIDE_URL + 'pyodide.mjs');
      const pyodide = await loadPyodide({ indexURL: PYODIDE_URL });
      // Define run_cases_json() from the harness the server sent us.
      pyodide.runPython(msg.harness);
      runCasesJson = pyodide.globals.get('run_cases_json');
      const python = pyodide.runPython("import sys; '%d.%d' % sys.version_info[:2]");
      self.postMessage({ type: 'ready', version: python });
    } else if (msg.type === 'run') {
      if (!runCasesJson) throw new Error('Python is not ready yet');
      const result = runCasesJson(msg.payload);
      self.postMessage({ type: 'result', id: msg.id, result });
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: msg.id, message: String(err && err.message ? err.message : err) });
  }
};
