/**
 * i18n Type Definitions
 *
 * TypeScript interfaces for translation files.
 * These interfaces ensure type safety when accessing translations.
 *
 * @packageDocumentation
 */

// ═══════════════════════════════════════════════════════════════════════════
// UI Translations Interface
// ═══════════════════════════════════════════════════════════════════════════

export interface UITranslations {
  session: {
    welcome: string;
    welcomeWithProject: string;
    askAnything: string;
    thinking: string;
    analyzing: string;
    reasoning: string;
    generating: string;
    searchingCodebase: string;
    editingFile: string;
    runningCommand: string;
    takingLonger: string;
    escToInterrupt: string;
    goodbye: string;
    sessionEnded: string;
  };

  status: {
    autoEdit: string;
    on: string;
    off: string;
    verbosity: string;
    quiet: string;
    concise: string;
    verbose: string;
    background: string;
    backgroundMode: string;
    thinking: string;
    thinkingMode: string;
    thinkingActive: string;
    context: string;
    contextAvailable: string;
    contextWarning: string;
  };

  tools: {
    executing: string;
    completed: string;
    failed: string;
    fileCreated: string;
    fileModified: string;
    fileDeleted: string;
    commandRunning: string;
    commandCompleted: string;
    searchingFiles: string;
    readingFile: string;
    writingFile: string;
  };

  usage: {
    tokens: string;
    tokensIn: string;
    tokensOut: string;
    totalTokens: string;
    promptTokens: string;
    completionTokens: string;
    reasoningTokens: string;
    estimatedCost: string;
    noRequests: string;
    startConversation: string;
  };

  toast: {
    verboseOn: string;
    verboseOff: string;
    backgroundOn: string;
    backgroundOff: string;
    autoEditOn: string;
    autoEditOff: string;
    thinkingOn: string;
    thinkingOff: string;
    historyCleared: string;
    copiedToClipboard: string;
    changesSaved: string;
    operationCancelled: string;
    contextLow: string;
    openingEditor: string;
    changesApplied: string;
    memoryCached: string;
    memoryRefreshed: string;
    usingCachedMemory: string;
    checkpointSaved: string;
    checkpointRestored: string;
    taskDone: string;
    taskFailed: string;
    pasteTruncated: string;
    largePasteAllowed: string;
  };

  confirm: {
    yes: string;
    yesRemember: string;
    no: string;
    cancelled: string;
  };

  actions: {
    clear: string;
    clearDesc: string;
    continue: string;
    continueDesc: string;
    exit: string;
    exitDesc: string;
    jumpToLatest: string;
    toggleVerbosity: string;
    toggleAutoEdit: string;
    toggleThinking: string;
    toggleBackground: string;
  };

  errors: {
    connectionFailed: string;
    apiError: string;
    rateLimited: string;
    retryIn: string;
    invalidInput: string;
    fileNotFound: string;
    permissionDenied: string;
    timeout: string;
    unknown: string;
  };

  categories: {
    navigation: string;
    settings: string;
    tools: string;
    help: string;
    explore: string;
    edit: string;
    create: string;
    execute: string;
  };

  welcome: {
    essentialShortcuts: string;
    modes: string;
    autoEdit: string;
    verboseOutput: string;
    backgroundMode: string;
    actions: string;
    allShortcuts: string;
    tryAsking: string;
    typeNaturally: string;
    exampleExplore: string;
    exampleEdit: string;
    exampleCreate: string;
    exampleExecute: string;
    quickStart: string;
    tip1: string;
    tip2Pre: string;
    tip2Post: string;
    tip3Pre: string;
    tip3Post: string;
    tip4Pre: string;
    tip4Post: string;
    exploreExamples: string[];
    editExamples: string[];
    createExamples: string[];
    executeExamples: string[];
  };

  shortcuts: {
    title: string;
    navigation: string;
    inputEditing: string;
    modeToggles: string;
    contentActions: string;
    quickCommands: string;
    quickActions: string;
    commands: string;
    sendMessage: string;
    interrupt: string;
    togglePaste: string;
    shiftEnterNote: string;
  };

  toolNames: {
    read: string;
    update: string;
    multiEdit: string;
    create: string;
    bash: string;
    taskOutput: string;
    search: string;
    todo: string;
    arguments: string;
    success: string;
    failed: string;
    executing: string;
    completed: string;
    lines: string;
    moreLines: string;
    fileContents: string;
    foundResults: string;
  };

  context: {
    title: string;
    pressToClose: string;
    summary: string;
    totalUsed: string;
    available: string;
    used: string;
    free: string;
    statusLabel: string;
    breakdownByCategory: string;
    critical: string;
    high: string;
    moderate: string;
    good: string;
    warningTitle: string;
    criticalWarning: string;
    highWarning: string;
    useClear: string;
    startNewSession: string;
    tipsTitle: string;
    plentyAvailable: string;
    contextIncludes: string;
    useClearIfNeeded: string;
    tipFooter: string;
  };

  hints: {
    send: string;
    newLine: string;
    complete: string;
    history: string;
    clearInput: string;
    quickSelect: string;
    navigate: string;
    select: string;
    cancel: string;
    close: string;
    searchHint: string;
    toggleAutoEdit: string;
    toggleVerbose: string;
    backgroundMode: string;
    allShortcuts: string;
    navigateHistory: string;
    moveCursorWord: string;
    moveLineStart: string;
    moveLineEnd: string;
    clearLine: string;
    deleteWord: string;
    deleteToStart: string;
    deleteCharBefore: string;
    deleteCharAfter: string;
    insertNewline: string;
    insertNewlineAlt: string;
    openQuickActions: string;
    expandCollapse: string;
    copyResponse: string;
    confirmCancel: string;
    escToClose: string;
    tipCommands: string;
  };

  input: {
    placeholder: string;
    pasting: string;
    pastedLines: string;
    expandHint: string;
    collapseHint: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Command Translations Interface
// ═══════════════════════════════════════════════════════════════════════════

export interface CommandTranslations {
  common: {
    error: string;
    success: string;
    warning: string;
    notFound: string;
    cancelled: string;
    loading: string;
    saving: string;
    done: string;
    failed: string;
    yes: string;
    no: string;
    confirm: string;
    skipConfirm: string;
    operationCancelled: string;
    runCommand: string;
  };

  lang: {
    title: string;
    currentLanguage: string;
    availableLanguages: string;
    languageChanged: string;
    unknownLanguage: string;
    usage: string;
    current: string;
  };

  status: {
    title: string;
    statusReport: string;
    noReportsFound: string;
    expectedLocation: string;
    reportsGeneratedWhen: string;
    planCompletes: string;
    moreReportsAvailable: string;
    availableReports: string;
    statusReports: string;
    noStatusReports: string;
    contextSummaries: string;
    noSummaries: string;
    viewReport: string;
    viewLocation: string;
    generationNotImplemented: string;
    autoGeneratedWhen: string;
    contextLimit: string;
    viewExisting: string;
    noOldReports: string;
    allReportsRecent: string;
    foundOldReports: string;
    useForceToDelete: string;
    deletedOldReports: string;
    sessions: {
      noSessionsFound: string;
      task: string;
      statusLabel: string;
      ago: string;
      progress: string;
      phases: string;
      cleanStale: string;
      cleanup: string;
      noStaleToClean: string;
      sessionsUpdatedWithin: string;
      foundStaleSessions: string;
      deletedAbandoned: string;
      deletedSessions: string;
      markedAbandoned: string;
    };
  };

  usage: {
    title: string;
    noRequests: string;
    startConversation: string;
    provider: string;
    model: string;
    totalRequests: string;
    promptTokens: string;
    completionTokens: string;
    totalTokens: string;
    reasoningTokens: string;
    estimatedCost: string;
    currentSession: string;
    cachedTokens: string;
    estimatedSavings: string;
    cacheHitRate: string;
    cacheSavings: string;
    sessionReset: string;
    performance: {
      title: string;
      noCallsRecorded: string;
      totalApiCalls: string;
      responseTime: string;
      average: string;
      min: string;
      max: string;
      percentiles: string;
      median: string;
      lowerBetter: string;
    };
    tools: {
      title: string;
      noToolCalls: string;
      toolsTracked: string;
      calls: string;
      successRate: string;
      avgExecTime: string;
      showingTop: string;
    };
    serverTools: {
      title: string;
      noServerToolCalls: string;
      serverToolsInfo: string;
      webSearch: string;
      xSearch: string;
      codeExecution: string;
      totalResults: string;
      avgResultsPerCall: string;
      bySearchType: string;
      keyword: string;
      semantic: string;
      successRateLabel: string;
      totalExecTime: string;
      runsOnXAI: string;
    };
  };

  doctor: {
    title: string;
    allChecksPassed: string;
    checking: string;
    nodeVersion: string;
    configFiles: string;
    apiConfig: string;
    modelConfig: string;
    mcpServers: string;
    zaiIntegration: string;
    dependencies: string;
    someChecksFailed: string;
    diagnosticsWithWarnings: string;
  };

  memory: {
    title: string;
    projectMemory: string;
    warmup: {
      scanning: string;
      generated: string;
      tokens: string;
      contextBreakdown: string;
      structure: string;
      readme: string;
      config: string;
      patterns: string;
      dryRunMode: string;
      savedTo: string;
      autoIncluded: string;
      cacheInfo: string;
    };
    refresh: {
      refreshing: string;
      noChanges: string;
      current: string;
      previous: string;
      useForce: string;
      updated: string;
      tokenDiff: string;
    };
    cacheStats: {
      noMemoryFound: string;
      memoryStats: string;
      cached: string;
      lastRefresh: string;
      tokenCount: string;
      hitCount: string;
      invalidated: string;
      statsReset: string;
      noStatsYet: string;
      statsCollectedWhen: string;
    };
    statusCmd: {
      runWarmup: string;
      projectMemory: string;
      status: string;
      created: string;
      lastUsed: string;
      version: string;
      contentHash: string;
      notInitialized: string;
      updated: string;
      context: string;
      hash: string;
      tokenDistribution: string;
    };
    projectMemoryStatus: {
      title: string;
      notConfigured: string;
    };
    clear: {
      title: string;
      confirm: string;
      cleared: string;
      nothingToClear: string;
      noMemoryToClear: string;
      confirmClear: string;
    };
    custom: {
      title: string;
      file: string;
      notFound: string;
      found: string;
      create: string;
      edit: string;
      show: string;
      delete: string;
      deleted: string;
      created: string;
      openingEditor: string;
      editorNotFound: string;
      useEditor: string;
      runInit: string;
      characters: string;
      opening: string;
      updated: string;
      failedToOpen: string;
      tryEditor: string;
      unknownSection: string;
      validSections: string;
      sectionNotFound: string;
      contentAdded: string;
      confirmReset: string;
      regenerating: string;
      resetToDefaults: string;
    };
    customInstructions: {
      title: string;
    };
    stats: {
      title: string;
      totalTokens: string;
      cacheHits: string;
      cacheMisses: string;
      hitRate: string;
      lastAccess: string;
      noStats: string;
      chars: string;
      words: string;
      lines: string;
      sections: string;
      estimatedTokens: string;
      content: string;
      name: string;
      type: string;
      language: string;
      template: string;
      lastUpdated: string;
      projectInfo: string;
    };
  };

  help: {
    title: string;
    availableCommands: string;
  };

  cache: {
    title: string;
    statistics: string;
    namespace: string;
    version: string;
    toolVersion: string;
    configuration: string;
    totalEntries: string;
    cacheSize: string;
    cacheHits: string;
    cacheMisses: string;
    invalidations: string;
    hitRate: string;
    createdAt: string;
    lastAccessed: string;
    totalCachedSize: string;
    metadata: string;
    useCommand: string;
    emptyCache: string;
    excellentPerformance: string;
    lowHitRate: string;
    allCleared: string;
    cleared: string;
    prunedEntry: string;
    prunedEntries: string;
    pruned: string;
    noExpiredEntries: string;
    noCachesFound: string;
    cacheNamespaces: string;
    file: string;
    size: string;
    modified: string;
    total: string;
    caches: string;
    cacheSystemInfo: string;
    cacheDirectory: string;
    howItWorks: string;
    changeDetection: string;
    configurationLabel: string;
    commandsLabel: string;
    performanceTips: string;
  };

  update: {
    title: string;
    currentVersion: string;
    checking: string;
    latestVersion: string;
    upToDate: string;
    updateAvailable: string;
    confirmUpdate: string;
    updating: string;
    updated: string;
  };

  init: {
    title: string;
  };

  mcp: {
    title: string;
  };

  vscode: {
    title: string;
    extensionStatus: string;
    vscodeNotFound: string;
    vscodeFound: string;
    notInstalled: string;
    installHint: string;
    installed: string;
    vsixFound: string;
    vsixNotFound: string;
    alreadyInstalled: string;
    forceReinstall: string;
    installing: string;
    uninstalling: string;
    uninstalled: string;
    reloadVscode: string;
  };
}
