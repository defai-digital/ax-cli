// Mock VSCode API for testing
export const workspace = {
  getConfiguration: () => ({
    get: () => undefined,
    has: () => false,
    inspect: () => undefined,
    update: () => Promise.resolve(),
  }),
  workspaceFolders: [],
  fs: {
    readFile: () => Promise.resolve(new Uint8Array()),
  },
};

export const window = {
  showInformationMessage: () => Promise.resolve(undefined),
  showErrorMessage: () => Promise.resolve(undefined),
  showWarningMessage: () => Promise.resolve(undefined),
  createOutputChannel: () => ({
    append: () => {},
    appendLine: () => {},
    clear: () => {},
    dispose: () => {},
  }),
  createStatusBarItem: () => ({
    text: '',
    tooltip: '',
    show: () => {},
    hide: () => {},
    dispose: () => {},
  }),
  createWebviewPanel: () => ({}),
};

export const languages = {
  getDiagnostics: () => [],
};

export const Uri = {
  file: (path: string) => ({ fsPath: path }),
  parse: (path: string) => ({ fsPath: path }),
  joinPath: (...paths: any[]) => ({ fsPath: paths.join('/') }),
};

export const Range = class {};
export const Position = class {};
export const Selection = class {};
export const Diagnostic = class {};
export const DiagnosticSeverity = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3,
};

export const StatusBarAlignment = {
  Left: 1,
  Right: 2,
};

export const ConfigurationTarget = {
  Global: 1,
  Workspace: 2,
  WorkspaceFolder: 3,
};

export const env = {
  clipboard: {
    writeText: () => Promise.resolve(),
    readText: () => Promise.resolve(''),
  },
  openExternal: () => Promise.resolve(true),
};

export const commands = {
  executeCommand: () => Promise.resolve(),
  registerCommand: () => ({ dispose: () => {} }),
};

export default {
  workspace,
  window,
  languages,
  Uri,
  Range,
  Position,
  Selection,
  Diagnostic,
  DiagnosticSeverity,
  StatusBarAlignment,
  ConfigurationTarget,
  env,
  commands,
};
