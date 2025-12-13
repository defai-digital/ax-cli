import fs from "fs-extra";
import path from "path";
import { writeFile as writeFilePromise } from "fs/promises";
import { ToolResult, EditorCommand } from "../types/index.js";
import { ConfirmationService } from "../utils/confirmation-service.js";
import { validatePathSecure } from "../utils/path-security.js";
import { getMessageOptimizer } from "../utils/message-optimizer.js";
import { isDestructiveFileOperation } from "../utils/safety-rules.js";
import { getAutoAcceptLogger } from "../utils/auto-accept-logger.js";
import { getSettingsManager } from "../utils/settings-manager.js";
import { ErrorCategory, createToolError } from "../utils/error-handler.js";
import { getVSCodeIPCClient } from "../ipc/index.js";

// Configuration constants
const EDITOR_CONFIG = {
  /** Number of context lines to show in diffs */
  DIFF_CONTEXT_LINES: 3,
  /** Minimum similarity score for fuzzy line matching */
  LINE_SIMILARITY_THRESHOLD: 0.75,
  /** Minimum similarity score for block matching */
  BLOCK_SIMILARITY_THRESHOLD: 0.55,
  /** Minimum similarity for suggestions */
  SUGGESTION_SIMILARITY_THRESHOLD: 0.4,
  /** File encoding */
  FILE_ENCODING: "utf-8" as const,
} as const;

// Error messages (centralized for consistency)
// Include actionable recovery guidance to help LLM self-correct
const RECOVERY_HINT = "TIP: Use view_file first to get the exact content before editing.";

const ERROR_MESSAGES = {
  FILE_NOT_FOUND: (filePath: string) => `File not found: ${filePath}. Use view_file to check the directory structure.`,
  FILE_ALREADY_EXISTS: (filePath: string) => `File already exists: ${filePath}. Use str_replace_editor or insert for edits instead of create.`,
  PATH_NOT_FOUND: (filePath: string) => `File or directory not found: ${filePath}`,
  SECURITY_ERROR: (error: string) => `Security: ${error}`,
  EMPTY_SEARCH_STRING: "Search string cannot be empty",
  STRING_NOT_FOUND: (str: string) => `String not found in file: "${str}". Use view_file to see the exact file contents and copy the correct text.`,
  STRING_NOT_FOUND_MULTI: "String not found in file. For multi-line replacements, use view_file to get the exact content including whitespace and indentation.",
  FILE_MODIFIED_DURING_CONFIRMATION: "File was modified by another process during confirmation. Please retry the operation.",
  NO_EDITS_TO_UNDO: "No edits to undo",
  EDIT_CANCELLED: (operation: string) => `${operation} cancelled by user`,
  NO_EDITS_PROVIDED: "No edits provided",
  EMPTY_OLD_STR: (index: number) => `Edit ${index + 1}: old_str cannot be empty`,
  RECOVERY_HINT,
  /** Append recovery hint to any error message */
  withRecoveryHint: (msg: string) => `${msg} ${RECOVERY_HINT}`,
} as const;

/**
 * Validate path security and return resolved path or error
 * Centralizes the repeated pattern of path validation across all methods
 */
async function validateAndResolvePath(filePath: string): Promise<{ path: string } | ToolResult> {
  const pathValidation = await validatePathSecure(filePath);
  if (!pathValidation.success) {
    return {
      success: false,
      error: ERROR_MESSAGES.SECURITY_ERROR(pathValidation.error || 'Unknown error'),
    };
  }
  // Path is guaranteed when success is true, but provide fallback for type safety
  return { path: pathValidation.path || filePath };
}

/**
 * Check if file exists and return appropriate error if not
 */
async function checkFileExists(filePath: string): Promise<ToolResult | null> {
  const resolvedPath = path.resolve(filePath);
  if (!(await fs.pathExists(resolvedPath))) {
    return {
      success: false,
      error: ERROR_MESSAGES.FILE_NOT_FOUND(filePath),
    };
  }
  return null;
}

/**
 * Atomically write content to file using temp file + rename pattern
 * Ensures either full write or no write (prevents partial writes)
 */
async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  try {
    await writeFilePromise(tempPath, content, EDITOR_CONFIG.FILE_ENCODING);
    await fs.rename(tempPath, filePath);
  } catch (writeError) {
    // Clean up temp file on failure
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw writeError;
  }
}

/**
 * Callback for creating checkpoints before file modifications
 */
export type CheckpointCallback = (files: Array<{ path: string; content: string }>, description: string) => Promise<void>;

export class TextEditorTool {
  private editHistory: EditorCommand[] = [];
  private confirmationService = ConfirmationService.getInstance();
  private checkpointCallback?: CheckpointCallback;

  async view(
    filePath: string,
    viewRange?: [number, number]
  ): Promise<ToolResult> {
    try {
      // SECURITY: Validate path to prevent traversal attacks (REQ-SEC-002)
      const pathResult = await validateAndResolvePath(filePath);
      if ('success' in pathResult) return pathResult; // Return error if validation failed

      const resolvedPath = pathResult.path;

      if (await fs.pathExists(resolvedPath)) {
        const stats = await fs.stat(resolvedPath);

        if (stats.isDirectory()) {
          const files = await fs.readdir(resolvedPath);
          return {
            success: true,
            output: `Directory contents of ${filePath}:\n${files.join("\n")}`,
          };
        }

        const content = await fs.readFile(resolvedPath, "utf-8");
        const lines = content.split("\n");

        if (viewRange) {
          const [start, end] = viewRange;

          // Validate line range
          if (start < 1) {
            return {
              success: false,
              error: `Invalid start line: ${start}. Line numbers must be >= 1.`,
            };
          }

          if (end < start) {
            return {
              success: false,
              error: `Invalid line range: end (${end}) must be >= start (${start}).`,
            };
          }

          if (start > lines.length) {
            return {
              success: false,
              error: `Start line ${start} exceeds file length (${lines.length} lines).`,
            };
          }

          // Clamp end to file length to avoid misleading output
          const actualEnd = Math.min(end, lines.length);
          const selectedLines = lines.slice(start - 1, actualEnd);
          const numberedLines = selectedLines
            .map((line, idx) => `${start + idx}: ${line}`)
            .join("\n");

          return {
            success: true,
            output: `Lines ${start}-${actualEnd} of ${filePath}:\n${numberedLines}`,
          };
        }

        // Format all lines with line numbers
        const allNumberedLines = lines
          .map((line, idx) => `${idx + 1}: ${line}`)
          .join("\n");

        const fullOutput = `Contents of ${filePath}:\n${allNumberedLines}`;

        // Apply message optimization for large files
        const optimizer = getMessageOptimizer();
        const optimized = optimizer.optimizeToolOutput(fullOutput, 'read_file');

        return {
          success: true,
          output: optimized.content,
        };
      } else {
        return {
          success: false,
          error: ERROR_MESSAGES.PATH_NOT_FOUND(filePath),
        };
      }
    } catch (error: any) {
      return createToolError(
        ErrorCategory.FILE_OPERATION,
        `View file`,
        error,
        { filePath }
      );
    }
  }

  async strReplace(
    filePath: string,
    oldStr: string,
    newStr: string,
    replaceAll: boolean = false
  ): Promise<ToolResult> {
    try {
      // SECURITY: Validate path to prevent traversal attacks (REQ-SEC-002)
      const pathResult = await validateAndResolvePath(filePath);
      if ('success' in pathResult) return pathResult;

      const resolvedPath = pathResult.path;

      // Validate inputs
      if (!oldStr) {
        return {
          success: false,
          error: ERROR_MESSAGES.EMPTY_SEARCH_STRING,
        };
      }

      // Check file exists
      const fileExistsError = await checkFileExists(resolvedPath);
      if (fileExistsError) {
        return fileExistsError;
      }

      // RACE CONDITION FIX: Read file with stat to get mtime for comparison
      const statsBefore = await fs.stat(resolvedPath);
      const content = await fs.readFile(resolvedPath, "utf-8");
      const mtimeBefore = statsBefore.mtimeMs;

      // Use actualOldStr to avoid modifying the parameter
      let actualOldStr = oldStr;

      if (!content.includes(oldStr)) {
        // Try whitespace-tolerant matching first
        const normalizedMatch = this.findNormalizedMatch(content, oldStr);
        if (normalizedMatch) {
          actualOldStr = normalizedMatch;
        } else if (oldStr.includes('\n')) {
          // Try fuzzy matching for multi-line strings
          const fuzzyResult = this.findFuzzyMatch(content, oldStr);
          if (fuzzyResult) {
            actualOldStr = fuzzyResult;
          } else {
            // Try line-by-line similarity matching
            const similarMatch = this.findSimilarBlock(content, oldStr);
            if (similarMatch.match) {
              actualOldStr = similarMatch.match;
            } else {
              // Provide helpful error with closest match info and recovery guidance
              const baseMsg = similarMatch.suggestion
                ? `String not found in file. ${similarMatch.suggestion}`
                : ERROR_MESSAGES.STRING_NOT_FOUND_MULTI;
              return {
                success: false,
                error: ERROR_MESSAGES.withRecoveryHint(baseMsg),
              };
            }
          }
        } else {
          // Single line - try to find similar line
          const similarLine = this.findSimilarLine(content, oldStr);
          if (similarLine.match) {
            actualOldStr = similarLine.match;
          } else {
            const baseMsg = similarLine.suggestion
              ? `String not found in file: "${oldStr}". ${similarLine.suggestion}`
              : ERROR_MESSAGES.STRING_NOT_FOUND(oldStr);
            return {
              success: false,
              error: ERROR_MESSAGES.withRecoveryHint(baseMsg),
            };
          }
        }
      }

      // Count occurrences using simple string splitting (more reliable than regex for multi-line strings)
      const occurrences = content.split(actualOldStr).length - 1;

      // Generate new content and diff for confirmation
      const newContent = replaceAll
        ? content.split(actualOldStr).join(newStr)
        : content.replace(actualOldStr, newStr);
      const oldLinesForDiff = content.split("\n");
      const newLinesForDiff = newContent.split("\n");
      let diffContent = this.generateDiff(oldLinesForDiff, newLinesForDiff, filePath);

      // Phase 2: Check if file operation is destructive
      const { isDestructive, matchedOperations } = isDestructiveFileOperation(filePath, 'edit');

      // Get auto-accept configuration
      const autoAcceptConfig = getSettingsManager().getAutoAcceptConfig();
      const isAutoAcceptEnabled = this.confirmationService.getSessionFlags().allOperations === true;

      // Determine if we should always confirm despite auto-accept
      const shouldAlwaysConfirm = isDestructive && matchedOperations.some(op =>
        autoAcceptConfig?.alwaysConfirm?.includes(op.id)
      );

      // Add safety warning to diff content if destructive
      if (isDestructive) {
        const warnings = matchedOperations.map(op =>
          `  - ${op.name}: ${op.description}`
        ).join('\n');
        diffContent = `⚠️  WARNING: This operation is flagged as destructive:\n${warnings}\n\n${diffContent}`;
      }

      const shouldProceed = await this.confirmationService.shouldProceed('file', {
        operation: `Edit file${replaceAll && occurrences > 1 ? ` (${occurrences} occurrences)` : ''}`,
        filename: filePath,
        showVSCodeOpen: false,
        content: diffContent,
        alwaysConfirm: shouldAlwaysConfirm, // Force confirmation for destructive ops
        // VS Code IPC diff preview fields
        oldContent: content,
        newContent: newContent,
        diffOperation: 'edit',
      });

      // Phase 2: Log to audit logger
      if (autoAcceptConfig && autoAcceptConfig.auditLog?.enabled) {
        const logger = getAutoAcceptLogger();
        logger.logFileOperation(
          'edit',
          filePath,
          isDestructive,
          shouldProceed, // userConfirmed = true if user confirmed (shouldProceed=true)
          isAutoAcceptEnabled && !shouldAlwaysConfirm, // autoAccepted = true if auto-accept AND not forced confirm
          autoAcceptConfig.scope || 'session'
        );
      }

      if (!shouldProceed) {
        return {
          success: false,
          error: ERROR_MESSAGES.EDIT_CANCELLED("File edit"),
        };
      }

      // RACE CONDITION FIX: Check if file was modified during confirmation
      // This prevents data loss from concurrent modifications
      const statsAfterConfirm = await fs.stat(resolvedPath);
      if (statsAfterConfirm.mtimeMs !== mtimeBefore) {
        return {
          success: false,
          error: ERROR_MESSAGES.FILE_MODIFIED_DURING_CONFIRMATION,
        };
      }

      // Create checkpoint before modification
      await this.createCheckpointIfNeeded(filePath, 'str_replace');

      // Atomic write
      await atomicWriteFile(resolvedPath, newContent);

      this.editHistory.push({
        command: "str_replace",
        path: filePath,
        old_str: oldStr,
        new_str: newStr,
      });

      // Reveal the file in VS Code (like Claude Code)
      const ipcClient = getVSCodeIPCClient();
      ipcClient.revealFile(resolvedPath, 'edit');

      return {
        success: true,
        output: diffContent,
      };
    } catch (error: any) {
      return createToolError(
        ErrorCategory.FILE_OPERATION,
        `Replace text`,
        error,
        { filePath }
      );
    }
  }

  async create(filePath: string, content: string): Promise<ToolResult> {
    try {
      // SECURITY: Validate path to prevent traversal attacks (REQ-SEC-002)
      const pathResult = await validateAndResolvePath(filePath);
      if ('success' in pathResult) return pathResult;

      const resolvedPath = pathResult.path;

      // Fail fast if the target already exists to avoid destructive overwrites
      if (await fs.pathExists(resolvedPath)) {
        return {
          success: false,
          error: ERROR_MESSAGES.FILE_ALREADY_EXISTS(filePath),
        };
      }

      // Create a diff-style preview for file creation
      const contentLines = content.split("\n");
      let diffContent = [
        `Created ${filePath}`,
        `--- /dev/null`,
        `+++ b/${filePath}`,
        `@@ -0,0 +1,${contentLines.length} @@`,
        ...contentLines.map((line) => `+${line}`),
      ].join("\n");

      // Phase 2: Check if file operation is destructive
      const { isDestructive, matchedOperations } = isDestructiveFileOperation(filePath, 'write');

      // Get auto-accept configuration
      const autoAcceptConfig = getSettingsManager().getAutoAcceptConfig();
      const isAutoAcceptEnabled = this.confirmationService.getSessionFlags().allOperations === true;

      // Determine if we should always confirm despite auto-accept
      const shouldAlwaysConfirm = isDestructive && matchedOperations.some(op =>
        autoAcceptConfig?.alwaysConfirm?.includes(op.id)
      );

      // Add safety warning to diff content if destructive
      if (isDestructive) {
        const warnings = matchedOperations.map(op =>
          `  - ${op.name}: ${op.description}`
        ).join('\n');
        diffContent = `⚠️  WARNING: This operation is flagged as destructive:\n${warnings}\n\n${diffContent}`;
      }

      const shouldProceed = await this.confirmationService.shouldProceed('file', {
        operation: "Write",
        filename: filePath,
        showVSCodeOpen: false,
        content: diffContent,
        alwaysConfirm: shouldAlwaysConfirm, // Force confirmation for destructive ops
        // VS Code IPC diff preview fields
        oldContent: '',  // Empty for new file
        newContent: content,
        diffOperation: 'create',
      });

      // Phase 2: Log to audit logger
      if (autoAcceptConfig && autoAcceptConfig.auditLog?.enabled) {
        const logger = getAutoAcceptLogger();
        logger.logFileOperation(
          'write',
          filePath,
          isDestructive,
          shouldProceed, // userConfirmed = true if user confirmed (shouldProceed=true)
          isAutoAcceptEnabled && !shouldAlwaysConfirm, // autoAccepted = true if auto-accept AND not forced confirm
          autoAcceptConfig.scope || 'session'
        );
      }

      if (!shouldProceed) {
        return {
          success: false,
          error: ERROR_MESSAGES.EDIT_CANCELLED("File creation"),
        };
      }

      // Create checkpoint before modification (will skip if file doesn't exist)
      await this.createCheckpointIfNeeded(filePath, 'create');

      const dir = path.dirname(resolvedPath);
      await fs.ensureDir(dir);

      // Atomic write
      await atomicWriteFile(resolvedPath, content);

      this.editHistory.push({
        command: "create",
        path: filePath,
        content,
      });

      // Reveal the file in VS Code (like Claude Code)
      const ipcClient = getVSCodeIPCClient();
      ipcClient.revealFile(resolvedPath, 'create');

      // Generate diff output using the same method as str_replace
      const oldLines: string[] = []; // Empty for new files
      const newLines = content.split("\n");
      const diff = this.generateDiff(oldLines, newLines, filePath);

      return {
        success: true,
        output: diff,
      };
    } catch (error: any) {
      return createToolError(
        ErrorCategory.FILE_OPERATION,
        `Create file`,
        error,
        { filePath }
      );
    }
  }

  async replaceLines(
    filePath: string,
    startLine: number,
    endLine: number,
    newContent: string
  ): Promise<ToolResult> {
    try {
      // SECURITY: Validate path to prevent traversal attacks (REQ-SEC-002)
      const pathResult = await validateAndResolvePath(filePath);
      if ('success' in pathResult) return pathResult;

      const resolvedPath = pathResult.path;

      const fileExistsError = await checkFileExists(resolvedPath);
      if (fileExistsError) {
        return fileExistsError;
      }

      const fileContent = await fs.readFile(resolvedPath, "utf-8");
      const lines = fileContent.split("\n");
      
      if (startLine < 1 || startLine > lines.length) {
        return {
          success: false,
          error: `Invalid start line: ${startLine}. File has ${lines.length} lines.`,
        };
      }
      
      if (endLine < startLine || endLine > lines.length) {
        return {
          success: false,
          error: `Invalid end line: ${endLine}. Must be between ${startLine} and ${lines.length}.`,
        };
      }

      const sessionFlags = this.confirmationService.getSessionFlags();
      if (!sessionFlags.fileOperations && !sessionFlags.allOperations) {
        const newLines = [...lines];
        const replacementLines = newContent.split("\n");
        newLines.splice(startLine - 1, endLine - startLine + 1, ...replacementLines);
        
        const diffContent = this.generateDiff(lines, newLines, filePath);

        const confirmationResult =
          await this.confirmationService.requestConfirmation(
            {
              operation: `Replace lines ${startLine}-${endLine}`,
              filename: filePath,
              showVSCodeOpen: false,
              content: diffContent,
              oldContent: fileContent,
              newContent: newLines.join("\n"),
              diffOperation: 'edit',
              lineStart: startLine,
              lineEnd: endLine,
            },
            "file"
          );

        if (!confirmationResult.confirmed) {
          return {
            success: false,
            error: confirmationResult.feedback || ERROR_MESSAGES.EDIT_CANCELLED("Line replacement"),
          };
        }
      }

      // Create checkpoint before modification
      await this.createCheckpointIfNeeded(filePath, 'replace_lines');

      const replacementLines = newContent.split("\n");
      lines.splice(startLine - 1, endLine - startLine + 1, ...replacementLines);
      const newFileContent = lines.join("\n");

      // Atomic write
      await atomicWriteFile(resolvedPath, newFileContent);

      this.editHistory.push({
        command: "str_replace",
        path: filePath,
        old_str: `lines ${startLine}-${endLine}`,
        new_str: newContent,
      });

      // Reveal the file in VS Code (like Claude Code)
      const ipcClient = getVSCodeIPCClient();
      ipcClient.revealFile(resolvedPath, 'edit');

      const oldLines = fileContent.split("\n");
      const diff = this.generateDiff(oldLines, lines, filePath);

      return {
        success: true,
        output: diff,
      };
    } catch (error: any) {
      return createToolError(
        ErrorCategory.FILE_OPERATION,
        `Replace lines`,
        error,
        { filePath }
      );
    }
  }

  async insert(
    filePath: string,
    insertLine: number,
    content: string
  ): Promise<ToolResult> {
    try {
      // SECURITY: Validate path to prevent traversal attacks (REQ-SEC-002)
      const pathResult = await validateAndResolvePath(filePath);
      if ('success' in pathResult) return pathResult;

      const resolvedPath = pathResult.path;

      const fileExistsError = await checkFileExists(resolvedPath);
      if (fileExistsError) {
        return fileExistsError;
      }

      const fileContent = await fs.readFile(resolvedPath, "utf-8");
      const lines = fileContent.split("\n");

      // Validate insert line
      if (insertLine < 1) {
        return {
          success: false,
          error: `Invalid insert line: ${insertLine}. Line numbers must be >= 1.`,
        };
      }

      if (insertLine > lines.length + 1) {
        return {
          success: false,
          error: `Invalid insert line: ${insertLine}. File has ${lines.length} lines (can insert at line ${lines.length + 1} to append).`,
        };
      }

      // Split content into individual lines for proper handling
      // This ensures multi-line content is correctly inserted and can be undone
      const contentLines = content.split("\n");
      const newLines = [...lines];
      newLines.splice(insertLine - 1, 0, ...contentLines);
      const newContent = newLines.join("\n");

      // Generate diff for confirmation
      const diffContent = this.generateDiff(lines, newLines, filePath);

      // Request confirmation (consistent with other editing methods)
      const shouldProceed = await this.confirmationService.shouldProceed('file', {
        operation: `Insert ${contentLines.length} line${contentLines.length !== 1 ? 's' : ''} at line ${insertLine}`,
        filename: filePath,
        showVSCodeOpen: false,
        content: diffContent,
        oldContent: fileContent,
        newContent: newContent,
        diffOperation: 'edit',
        lineStart: insertLine,
        lineEnd: insertLine,
      });

      if (!shouldProceed) {
        return {
          success: false,
          error: ERROR_MESSAGES.EDIT_CANCELLED("Insert operation"),
        };
      }

      // Create checkpoint before modification
      await this.createCheckpointIfNeeded(filePath, 'insert');

      // Atomic write
      await atomicWriteFile(resolvedPath, newContent);

      this.editHistory.push({
        command: "insert",
        path: filePath,
        insert_line: insertLine,
        content,
      });

      // Reveal the file in VS Code (like Claude Code)
      const ipcClient = getVSCodeIPCClient();
      ipcClient.revealFile(resolvedPath, 'edit');

      return {
        success: true,
        output: diffContent,
      };
    } catch (error: any) {
      return createToolError(
        ErrorCategory.FILE_OPERATION,
        `Insert content`,
        error,
        { filePath }
      );
    }
  }

  /**
   * Make multiple edits to a file in a single atomic operation.
   * All edits are validated and previewed before applying.
   * If any edit fails validation, the entire operation is aborted.
   */
  async multiEdit(
    filePath: string,
    edits: Array<{ old_str: string; new_str: string }>
  ): Promise<ToolResult> {
    try {
      // SECURITY: Validate path to prevent traversal attacks
      const pathResult = await validateAndResolvePath(filePath);
      if ('success' in pathResult) return pathResult;

      const resolvedPath = pathResult.path;

      // Validate inputs
      if (!edits || edits.length === 0) {
        return {
          success: false,
          error: ERROR_MESSAGES.NO_EDITS_PROVIDED,
        };
      }

      for (let i = 0; i < edits.length; i++) {
        if (!edits[i].old_str) {
          return {
            success: false,
            error: `Edit ${i + 1}: old_str cannot be empty`,
          };
        }
      }

      // Check file exists
      const fileExistsError = await checkFileExists(resolvedPath);
      if (fileExistsError) {
        return fileExistsError;
      }

      // Read file with stat to get mtime for race condition protection
      const statsBefore = await fs.stat(resolvedPath);
      const originalContent = await fs.readFile(resolvedPath, "utf-8");
      const mtimeBefore = statsBefore.mtimeMs;

      // Apply all edits sequentially to validate and generate preview
      let workingContent = originalContent;
      const appliedEdits: Array<{ old_str: string; new_str: string; actualOldStr: string }> = [];

      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        let actualOldStr = edit.old_str;

        if (!workingContent.includes(edit.old_str)) {
          // Try whitespace-tolerant matching
          const normalizedMatch = this.findNormalizedMatch(workingContent, edit.old_str);
          if (normalizedMatch) {
            actualOldStr = normalizedMatch;
          } else if (edit.old_str.includes('\n')) {
            // Try fuzzy matching for multi-line strings
            const fuzzyResult = this.findFuzzyMatch(workingContent, edit.old_str);
            if (fuzzyResult) {
              actualOldStr = fuzzyResult;
            } else {
              const similarMatch = this.findSimilarBlock(workingContent, edit.old_str);
              if (similarMatch.match) {
                actualOldStr = similarMatch.match;
              } else {
                const baseMsg = similarMatch.suggestion
                  ? `Edit ${i + 1}: String not found. ${similarMatch.suggestion}`
                  : `Edit ${i + 1}: String not found in file (after applying previous edits).`;
                return {
                  success: false,
                  error: ERROR_MESSAGES.withRecoveryHint(baseMsg),
                };
              }
            }
          } else {
            const similarLine = this.findSimilarLine(workingContent, edit.old_str);
            if (similarLine.match) {
              actualOldStr = similarLine.match;
            } else {
              const baseMsg = similarLine.suggestion
                ? `Edit ${i + 1}: String not found: "${edit.old_str}". ${similarLine.suggestion}`
                : `Edit ${i + 1}: String not found: "${edit.old_str}".`;
              return {
                success: false,
                error: ERROR_MESSAGES.withRecoveryHint(baseMsg),
              };
            }
          }
        }

        // Apply this edit to working content
        workingContent = workingContent.replace(actualOldStr, edit.new_str);
        appliedEdits.push({ ...edit, actualOldStr });
      }

      // Generate unified diff showing all changes
      const oldLines = originalContent.split("\n");
      const newLines = workingContent.split("\n");
      let diffContent = this.generateDiff(oldLines, newLines, filePath);

      // Add edit count to diff header
      diffContent = `Multi-edit: ${edits.length} changes\n${diffContent}`;

      // Check if file operation is destructive
      const { isDestructive, matchedOperations } = isDestructiveFileOperation(filePath, 'edit');

      // Get auto-accept configuration
      const autoAcceptConfig = getSettingsManager().getAutoAcceptConfig();
      const isAutoAcceptEnabled = this.confirmationService.getSessionFlags().allOperations === true;

      const shouldAlwaysConfirm = isDestructive && matchedOperations.some(op =>
        autoAcceptConfig?.alwaysConfirm?.includes(op.id)
      );

      if (isDestructive) {
        const warnings = matchedOperations.map(op =>
          `  - ${op.name}: ${op.description}`
        ).join('\n');
        diffContent = `⚠️  WARNING: This operation is flagged as destructive:\n${warnings}\n\n${diffContent}`;
      }

      const shouldProceed = await this.confirmationService.shouldProceed('file', {
        operation: `Multi-edit (${edits.length} changes)`,
        filename: filePath,
        showVSCodeOpen: false,
        content: diffContent,
        alwaysConfirm: shouldAlwaysConfirm,
        // VS Code IPC diff preview fields
        oldContent: originalContent,
        newContent: workingContent,
        diffOperation: 'edit',
      });

      // Audit logging
      if (autoAcceptConfig && autoAcceptConfig.auditLog?.enabled) {
        const logger = getAutoAcceptLogger();
        logger.logFileOperation(
          'edit',
          filePath,
          isDestructive,
          shouldProceed, // BUG FIX: was !shouldProceed (inverted)
          isAutoAcceptEnabled && !shouldAlwaysConfirm,
          autoAcceptConfig.scope || 'session'
        );
      }

      if (!shouldProceed) {
        return {
          success: false,
          error: ERROR_MESSAGES.EDIT_CANCELLED("Multi-edit"),
        };
      }

      // Race condition check
      const statsAfterConfirm = await fs.stat(resolvedPath);
      if (statsAfterConfirm.mtimeMs !== mtimeBefore) {
        return {
          success: false,
          error: ERROR_MESSAGES.FILE_MODIFIED_DURING_CONFIRMATION,
        };
      }

      // Create checkpoint before modification
      await this.createCheckpointIfNeeded(filePath, 'multi_edit');

      // Atomic write
      await atomicWriteFile(resolvedPath, workingContent);

      // Record in edit history
      this.editHistory.push({
        command: "str_replace",
        path: filePath,
        old_str: `[multi-edit: ${edits.length} changes]`,
        new_str: workingContent,
      });

      // Reveal the file in VS Code (like Claude Code)
      const ipcClient = getVSCodeIPCClient();
      ipcClient.revealFile(resolvedPath, 'edit');

      return {
        success: true,
        output: diffContent,
      };
    } catch (error: any) {
      return createToolError(
        ErrorCategory.FILE_OPERATION,
        `Multi-edit file`,
        error,
        { filePath }
      );
    }
  }

  async undoEdit(): Promise<ToolResult> {
    if (this.editHistory.length === 0) {
      return {
        success: false,
        error: ERROR_MESSAGES.NO_EDITS_TO_UNDO,
      };
    }

    const lastEdit = this.editHistory.pop();
    if (!lastEdit) {
      return {
        success: false,
        error: "Failed to retrieve last edit",
      };
    }

    try {
      switch (lastEdit.command) {
        case "str_replace":
          if (lastEdit.path && lastEdit.old_str && lastEdit.new_str) {
            const content = await fs.readFile(lastEdit.path, "utf-8");
            const revertedContent = content.replace(
              lastEdit.new_str,
              lastEdit.old_str
            );
            await writeFilePromise(lastEdit.path, revertedContent, "utf-8");
          }
          break;

        case "create":
          if (lastEdit.path) {
            await fs.remove(lastEdit.path);
          }
          break;

        case "insert":
          if (lastEdit.path && lastEdit.insert_line && lastEdit.content !== undefined) {
            const content = await fs.readFile(lastEdit.path, "utf-8");
            const lines = content.split("\n");
            // Count how many lines were inserted (content may be multi-line)
            const insertedLineCount = lastEdit.content.split("\n").length;
            lines.splice(lastEdit.insert_line - 1, insertedLineCount);
            await writeFilePromise(lastEdit.path, lines.join("\n"), "utf-8");
          }
          break;
      }

      return {
        success: true,
        output: `Successfully undid ${lastEdit.command} operation`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Error undoing edit: ${error.message}`,
      };
    }
  }

  private findFuzzyMatch(content: string, searchStr: string): string | null {
    const functionMatch = searchStr.match(/function\s+(\w+)/);
    if (!functionMatch || !functionMatch[1]) return null;

    const functionName = functionMatch[1];
    const contentLines = content.split('\n');
    
    let functionStart = -1;
    for (let i = 0; i < contentLines.length; i++) {
      if (contentLines[i].includes(`function ${functionName}`) && contentLines[i].includes('{')) {
        functionStart = i;
        break;
      }
    }
    
    if (functionStart === -1) return null;
    
    let braceCount = 0;
    let functionEnd = functionStart;
    let foundClosingBrace = false;

    for (let i = functionStart; i < contentLines.length; i++) {
      const line = contentLines[i];
      for (const char of line) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }

      if (braceCount === 0 && i > functionStart) {
        functionEnd = i;
        foundClosingBrace = true;
        break;
      }
    }

    // BUG FIX: Reject unclosed functions (braces not balanced)
    if (!foundClosingBrace && braceCount !== 0) {
      return null;
    }

    const actualFunction = contentLines.slice(functionStart, functionEnd + 1).join('\n');
    
    const searchNormalized = this.normalizeForComparison(searchStr);
    const actualNormalized = this.normalizeForComparison(actualFunction);
    
    if (this.isSimilarStructure(searchNormalized, actualNormalized)) {
      return actualFunction;
    }
    
    return null;
  }
  
  private normalizeForComparison(str: string): string {
    return str
      .replace(/["'`]/g, '"')
      .replace(/\s+/g, ' ')
      .replace(/{\s+/g, '{ ')
      .replace(/\s+}/g, ' }')
      .replace(/;\s*/g, ';')
      .trim();
  }
  
  private isSimilarStructure(search: string, actual: string): boolean {
    const extractTokens = (str: string) => {
      const tokens = str.match(/\b(function|console\.log|return|if|else|for|while)\b/g) || [];
      return tokens;
    };
    
    const searchTokens = extractTokens(search);
    const actualTokens = extractTokens(actual);
    
    if (searchTokens.length !== actualTokens.length) return false;
    
    for (let i = 0; i < searchTokens.length; i++) {
      if (searchTokens[i] !== actualTokens[i]) return false;
    }
    
    return true;
  }

  private generateDiff(
    oldLines: string[],
    newLines: string[],
    filePath: string
  ): string {
    const CONTEXT_LINES = EDITOR_CONFIG.DIFF_CONTEXT_LINES;
    
    const changes: Array<{
      oldStart: number;
      oldEnd: number;
      newStart: number;
      newEnd: number;
    }> = [];
    
    let i = 0, j = 0;
    
    while (i < oldLines.length || j < newLines.length) {
      while (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
        i++;
        j++;
      }
      
      if (i < oldLines.length || j < newLines.length) {
        const changeStart = { old: i, new: j };

        let oldEnd = i;
        let newEnd = j;
        // BUG FIX: Add iteration counter to prevent O(n²) complexity on adversarial inputs
        const maxIterations = oldLines.length + newLines.length;
        let iterations = 0;

        while (oldEnd < oldLines.length || newEnd < newLines.length) {
          // Safety check: prevent excessive iterations
          if (++iterations > maxIterations) {
            break;
          }

          let matchFound = false;
          let matchLength = 0;

          for (let k = 0; k < Math.min(2, oldLines.length - oldEnd, newLines.length - newEnd); k++) {
            if (oldEnd + k < oldLines.length &&
                newEnd + k < newLines.length &&
                oldLines[oldEnd + k] === newLines[newEnd + k]) {
              matchLength++;
            } else {
              break;
            }
          }

          if (matchLength >= 2 || (oldEnd >= oldLines.length && newEnd >= newLines.length)) {
            matchFound = true;
          }

          if (matchFound) {
            break;
          }

          // Prevent infinite loop - ensure progress is made
          let progress = false;
          if (oldEnd < oldLines.length) { oldEnd++; progress = true; }
          if (newEnd < newLines.length) { newEnd++; progress = true; }

          if (!progress) {
            // Both reached end, force exit to prevent infinite loop
            break;
          }
        }
        
        changes.push({
          oldStart: changeStart.old,
          oldEnd: oldEnd,
          newStart: changeStart.new,
          newEnd: newEnd
        });
        
        i = oldEnd;
        j = newEnd;
      }
    }
    
    const hunks: Array<{
      oldStart: number;
      oldCount: number;
      newStart: number;
      newCount: number;
      lines: Array<{ type: '+' | '-' | ' '; content: string }>;
    }> = [];
    
    let accumulatedOffset = 0;
    
    for (let changeIdx = 0; changeIdx < changes.length; changeIdx++) {
      const change = changes[changeIdx];
      
      let contextStart = Math.max(0, change.oldStart - CONTEXT_LINES);
      let contextEnd = Math.min(oldLines.length, change.oldEnd + CONTEXT_LINES);
      
      if (hunks.length > 0) {
        const lastHunk = hunks[hunks.length - 1];
        const lastHunkEnd = lastHunk.oldStart + lastHunk.oldCount;
        
        if (lastHunkEnd >= contextStart) {
          const oldHunkEnd = lastHunk.oldStart + lastHunk.oldCount;
          const newContextEnd = Math.min(oldLines.length, change.oldEnd + CONTEXT_LINES);
          
          for (let idx = oldHunkEnd; idx < change.oldStart; idx++) {
            lastHunk.lines.push({ type: ' ', content: oldLines[idx] });
          }
          
          for (let idx = change.oldStart; idx < change.oldEnd; idx++) {
            lastHunk.lines.push({ type: '-', content: oldLines[idx] });
          }
          for (let idx = change.newStart; idx < change.newEnd; idx++) {
            lastHunk.lines.push({ type: '+', content: newLines[idx] });
          }
          
          for (let idx = change.oldEnd; idx < newContextEnd && idx < oldLines.length; idx++) {
            lastHunk.lines.push({ type: ' ', content: oldLines[idx] });
          }
          
          lastHunk.oldCount = newContextEnd - lastHunk.oldStart;
          lastHunk.newCount = lastHunk.oldCount + (change.newEnd - change.newStart) - (change.oldEnd - change.oldStart);
          
          continue;
        }
      }
      
      const hunk: typeof hunks[0] = {
        oldStart: contextStart + 1,
        oldCount: contextEnd - contextStart,
        newStart: contextStart + 1 + accumulatedOffset,
        newCount: contextEnd - contextStart + (change.newEnd - change.newStart) - (change.oldEnd - change.oldStart),
        lines: []
      };
      
      for (let idx = contextStart; idx < change.oldStart; idx++) {
        hunk.lines.push({ type: ' ', content: oldLines[idx] });
      }
      
      for (let idx = change.oldStart; idx < change.oldEnd; idx++) {
        hunk.lines.push({ type: '-', content: oldLines[idx] });
      }
      
      for (let idx = change.newStart; idx < change.newEnd; idx++) {
        hunk.lines.push({ type: '+', content: newLines[idx] });
      }
      
      for (let idx = change.oldEnd; idx < contextEnd && idx < oldLines.length; idx++) {
        hunk.lines.push({ type: ' ', content: oldLines[idx] });
      }
      
      hunks.push(hunk);
      
      accumulatedOffset += (change.newEnd - change.newStart) - (change.oldEnd - change.oldStart);
    }
    
    let addedLines = 0;
    let removedLines = 0;
    
    for (const hunk of hunks) {
      for (const line of hunk.lines) {
        if (line.type === '+') addedLines++;
        if (line.type === '-') removedLines++;
      }
    }
    
    let summary = `Updated ${filePath}`;
    if (addedLines > 0 && removedLines > 0) {
      summary += ` with ${addedLines} addition${
        addedLines !== 1 ? "s" : ""
      } and ${removedLines} removal${removedLines !== 1 ? "s" : ""}`;
    } else if (addedLines > 0) {
      summary += ` with ${addedLines} addition${addedLines !== 1 ? "s" : ""}`;
    } else if (removedLines > 0) {
      summary += ` with ${removedLines} removal${
        removedLines !== 1 ? "s" : ""
      }`;
    } else if (changes.length === 0) {
      return `No changes in ${filePath}`;
    }
    
    let diff = summary + "\n";
    diff += `--- a/${filePath}\n`;
    diff += `+++ b/${filePath}\n`;
    
    for (const hunk of hunks) {
      diff += `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@\n`;
      
      for (const line of hunk.lines) {
        diff += `${line.type}${line.content}\n`;
      }
    }
    
    return diff.trim();
  }

  getEditHistory(): EditorCommand[] {
    return [...this.editHistory];
  }

  /**
   * Set checkpoint callback for automatic checkpoint creation before file modifications
   */
  setCheckpointCallback(callback: CheckpointCallback): void {
    this.checkpointCallback = callback;
  }

  /**
   * Create checkpoint before modifying a file
   */
  private async createCheckpointIfNeeded(filePath: string, operation: string): Promise<void> {
    if (!this.checkpointCallback) {
      return;
    }

    try {
      const resolvedPath = path.resolve(filePath);

      // Read current file content if it exists
      if (await fs.pathExists(resolvedPath)) {
        const content = await fs.readFile(resolvedPath, "utf-8");
        await this.checkpointCallback(
          [{ path: filePath, content }],
          `Before ${operation}: ${filePath}`
        );
      }
    } catch (error) {
      // Don't fail the operation if checkpoint creation fails
      console.warn(`Failed to create checkpoint: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find a match by normalizing whitespace differences
   * Handles: trailing whitespace, tabs vs spaces, line ending differences, indentation changes
   */
  private findNormalizedMatch(content: string, searchStr: string): string | null {
    // Normalize line endings first
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const normalizedSearch = searchStr.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // If exact match after line ending normalization, find and return the actual string
    if (normalizedContent.includes(normalizedSearch)) {
      // Find the position in normalized content
      const startPos = normalizedContent.indexOf(normalizedSearch);
      const endPos = startPos + normalizedSearch.length;

      // Map position back to original content
      let originalStartPos = 0;
      let normalizedPos = 0;
      for (let i = 0; i < content.length && normalizedPos < startPos; i++) {
        if (content[i] === '\r' && content[i + 1] === '\n') {
          normalizedPos++; // \r\n becomes \n
          i++; // Skip the \n
        } else if (content[i] === '\r') {
          normalizedPos++; // \r becomes \n
        } else {
          normalizedPos++;
        }
        originalStartPos = i + 1;
      }

      // Find the end position in original
      let originalEndPos = originalStartPos;
      for (let i = originalStartPos; i < content.length && normalizedPos < endPos; i++) {
        if (content[i] === '\r' && content[i + 1] === '\n') {
          normalizedPos++;
          i++;
        } else if (content[i] === '\r') {
          normalizedPos++;
        } else {
          normalizedPos++;
        }
        originalEndPos = i + 1;
      }

      return content.substring(originalStartPos, originalEndPos);
    }

    const contentLines = content.split(/\r\n|\r|\n/);
    const searchLines = searchStr.split(/\r\n|\r|\n/);

    // Filter out empty lines from search for more flexible matching
    const searchLinesNonEmpty = searchLines.filter(l => l.trim().length > 0);

    // Try matching with trailing whitespace trimmed from each line
    for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
      let match = true;
      for (let j = 0; j < searchLines.length; j++) {
        const contentLine = contentLines[i + j].trimEnd();
        const searchLine = searchLines[j].trimEnd();
        if (contentLine !== searchLine) {
          match = false;
          break;
        }
      }
      if (match) {
        return this.extractOriginalBlock(content, i, searchLines.length);
      }
    }

    // Try matching with all whitespace fully normalized (aggressive mode)
    // This handles indentation differences like 2-space vs 4-space
    for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
      let match = true;
      for (let j = 0; j < searchLines.length; j++) {
        const contentLine = this.normalizeLineAggressively(contentLines[i + j]);
        const searchLine = this.normalizeLineAggressively(searchLines[j]);
        if (contentLine !== searchLine) {
          match = false;
          break;
        }
      }
      if (match) {
        return this.extractOriginalBlock(content, i, searchLines.length);
      }
    }

    // Try matching with blank lines skipped in both (handles extra/missing blank lines)
    const contentLinesNonEmpty = contentLines.map((l, idx) => ({ line: l, idx })).filter(x => x.line.trim().length > 0);

    if (searchLinesNonEmpty.length > 0 && searchLinesNonEmpty.length <= contentLinesNonEmpty.length) {
      for (let i = 0; i <= contentLinesNonEmpty.length - searchLinesNonEmpty.length; i++) {
        let match = true;
        for (let j = 0; j < searchLinesNonEmpty.length; j++) {
          const contentLine = this.normalizeLineAggressively(contentLinesNonEmpty[i + j].line);
          const searchLine = this.normalizeLineAggressively(searchLinesNonEmpty[j]);
          if (contentLine !== searchLine) {
            match = false;
            break;
          }
        }
        if (match) {
          // Found a match - extract from first to last matching line
          const startIdx = contentLinesNonEmpty[i].idx;
          const endIdx = contentLinesNonEmpty[i + searchLinesNonEmpty.length - 1].idx;
          return this.extractOriginalBlock(content, startIdx, endIdx - startIdx + 1);
        }
      }
    }

    return null;
  }

  /**
   * Aggressively normalize a line for matching - removes all indentation and collapses whitespace
   * Limits line length to prevent ReDoS on extremely long inputs
   */
  private normalizeLineAggressively(line: string): string {
    // Limit line length to prevent ReDoS attacks on extremely long lines
    const MAX_LINE_LENGTH = 10000;
    const safeLine = line.length > MAX_LINE_LENGTH ? line.slice(0, MAX_LINE_LENGTH) : line;
    return safeLine
      .trim()  // Remove leading/trailing whitespace completely
      .replace(/\s+/g, ' ')  // Collapse multiple spaces to single space
      .replace(/\s*([{}()[\];,:])\s*/g, '$1')  // Remove spaces around punctuation
      .replace(/["'`]/g, '"');  // Normalize quote styles
  }

  /**
   * Extract a block of lines from original content, preserving original line endings
   */
  private extractOriginalBlock(content: string, startLineIdx: number, numLines: number): string {
    // Find line positions in original content
    const linePositions: Array<{ start: number; end: number }> = [];
    let pos = 0;
    let lineStart = 0;

    while (pos <= content.length) {
      if (pos === content.length || content[pos] === '\n' || content[pos] === '\r') {
        const lineEnd = pos;
        linePositions.push({ start: lineStart, end: lineEnd });

        if (pos < content.length) {
          // Skip line ending
          if (content[pos] === '\r' && content[pos + 1] === '\n') {
            pos += 2;
          } else {
            pos += 1;
          }
          lineStart = pos;
        } else {
          break;
        }
      } else {
        pos++;
      }
    }

    // Extract the requested lines
    // BUG FIX: Also validate numLines to prevent negative endLineIdx calculation
    if (startLineIdx >= linePositions.length || numLines <= 0) {
      return '';
    }

    const endLineIdx = Math.min(startLineIdx + numLines - 1, linePositions.length - 1);
    const blockStart = linePositions[startLineIdx].start;
    const blockEnd = linePositions[endLineIdx].end;

    return content.substring(blockStart, blockEnd);
  }

  /**
   * Normalize indentation by converting tabs to spaces and trimming trailing whitespace
   */
  private normalizeIndentation(line: string): string {
    return line.replace(/\t/g, '  ').trimEnd();
  }

  /**
   * Find a similar block of code using line-by-line similarity matching
   * Uses aggressive normalization and wider search windows
   */
  private findSimilarBlock(content: string, searchStr: string): { match: string | null; suggestion?: string } {
    const contentLines = content.split(/\r?\n/);
    const searchLines = searchStr.split(/\r?\n/);

    if (searchLines.length === 0) {
      return { match: null };
    }

    // Filter out blank lines for more robust matching
    const searchLinesNonEmpty = searchLines.filter(l => l.trim().length > 0);
    if (searchLinesNonEmpty.length === 0) {
      return { match: null };
    }

    // Find the best matching block
    let bestMatch: { startIdx: number; endIdx: number; score: number } | null = null;
    const minScore = EDITOR_CONFIG.BLOCK_SIMILARITY_THRESHOLD;

    // Normalize first search line for initial matching
    const firstSearchLineNorm = this.normalizeLineAggressively(searchLinesNonEmpty[0]);

    for (let i = 0; i < contentLines.length; i++) {
      const firstContentLineNorm = this.normalizeLineAggressively(contentLines[i]);

      // Quick check: first non-empty line should have some similarity (using normalized comparison)
      if (firstContentLineNorm.length === 0) continue;
      if (this.lineSimilarityNormalized(firstContentLineNorm, firstSearchLineNorm) < EDITOR_CONFIG.SUGGESTION_SIMILARITY_THRESHOLD) {
        continue;
      }

      // Try to match the block starting at this position - wider window (+15 instead of +5)
      const blockEnd = Math.min(i + searchLines.length + 15, contentLines.length);

      for (let endIdx = Math.max(i, i + searchLinesNonEmpty.length - 3); endIdx <= blockEnd; endIdx++) {
        if (endIdx < i) continue;

        const candidateLines = contentLines.slice(i, endIdx + 1);
        const score = this.blockSimilarityNormalized(candidateLines, searchLinesNonEmpty);

        if (score >= minScore && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { startIdx: i, endIdx, score };
        }
      }
    }

    if (bestMatch && bestMatch.score >= minScore) {
      return { match: contentLines.slice(bestMatch.startIdx, bestMatch.endIdx + 1).join('\n') };
    }

    // If no match found, try to provide a helpful suggestion
    const suggestion = this.findClosestMatchSuggestion(contentLines, searchLines);
    return { match: null, suggestion };
  }

  /**
   * Line similarity using normalized comparison
   */
  private lineSimilarityNormalized(norm1: string, norm2: string): number {
    if (norm1 === norm2) return 1;
    if (norm1.length === 0 && norm2.length === 0) return 1;
    if (norm1.length === 0 || norm2.length === 0) return 0;

    const maxLen = Math.max(norm1.length, norm2.length);
    const distance = this.levenshteinDistance(norm1, norm2);
    return 1 - (distance / maxLen);
  }

  /**
   * Block similarity using normalized lines and skipping blank lines
   */
  private blockSimilarityNormalized(candidateLines: string[], searchLinesNonEmpty: string[]): number {
    if (searchLinesNonEmpty.length === 0) return 0;

    // Normalize and filter candidate lines
    const candidateNonEmpty = candidateLines
      .map(l => this.normalizeLineAggressively(l))
      .filter(l => l.length > 0);

    if (candidateNonEmpty.length === 0) return 0;

    // Use LCS-style matching for better tolerance
    let matchedCount = 0;
    let ci = 0;

    for (const searchLine of searchLinesNonEmpty) {
      const searchNorm = this.normalizeLineAggressively(searchLine);
      if (searchNorm.length === 0) continue;

      // Look for a matching line in remaining candidates
      while (ci < candidateNonEmpty.length) {
        const sim = this.lineSimilarityNormalized(candidateNonEmpty[ci], searchNorm);
        ci++;
        if (sim >= 0.5) {
          matchedCount++;
          break;
        }
      }
    }

    return matchedCount / searchLinesNonEmpty.length;
  }

  /**
   * Calculate similarity between two lines (0-1)
   */
  private lineSimilarity(line1: string, line2: string): number {
    const s1 = line1.trim();
    const s2 = line2.trim();

    if (s1 === s2) return 1;
    if (s1.length === 0 && s2.length === 0) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    // Use Levenshtein distance-based similarity
    const maxLen = Math.max(s1.length, s2.length);
    const distance = this.levenshteinDistance(s1, s2);
    return 1 - (distance / maxLen);
  }


  /**
   * Levenshtein distance for string similarity
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;

    // Use two rows instead of full matrix for memory efficiency
    let prev = new Array(n + 1);
    let curr = new Array(n + 1);

    for (let j = 0; j <= n; j++) {
      prev[j] = j;
    }

    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          curr[j] = prev[j - 1];
        } else {
          curr[j] = 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
        }
      }
      [prev, curr] = [curr, prev];
    }

    return prev[n];
  }

  /**
   * Find and suggest the closest matching location
   */
  private findClosestMatchSuggestion(contentLines: string[], searchLines: string[]): string | undefined {
    if (searchLines.length === 0) return undefined;

    const firstSearchLine = searchLines[0].trim();
    let bestLineIdx = -1;
    let bestSim = 0;

    for (let i = 0; i < contentLines.length; i++) {
      const sim = this.lineSimilarity(contentLines[i], firstSearchLine);
      if (sim > bestSim) {
        bestSim = sim;
        bestLineIdx = i;
      }
    }

    if (bestLineIdx >= 0 && bestSim >= EDITOR_CONFIG.SUGGESTION_SIMILARITY_THRESHOLD) {
      const actualLine = contentLines[bestLineIdx].trim();
      const lineNum = bestLineIdx + 1;

      if (bestSim < 0.9) {
        return `Did you mean line ${lineNum}? Found: "${actualLine.substring(0, 60)}${actualLine.length > 60 ? '...' : ''}"`;
      }
    }

    return undefined;
  }

  /**
   * Find a similar single line in the content
   */
  private findSimilarLine(content: string, searchStr: string): { match: string | null; suggestion?: string } {
    const lines = content.split(/\r?\n/);
    const searchTrimmed = searchStr.trim();

    // First try exact match with trimmed whitespace
    for (const line of lines) {
      if (line.trim() === searchTrimmed) {
        return { match: line };
      }
    }

    // Try normalized indentation match
    const searchNormalized = this.normalizeIndentation(searchStr);
    for (const line of lines) {
      if (this.normalizeIndentation(line) === searchNormalized) {
        return { match: line };
      }
    }

    // Find best similar line
    let bestLine: string | null = null;
    let bestSim = 0;
    const minSim = EDITOR_CONFIG.LINE_SIMILARITY_THRESHOLD;

    for (const line of lines) {
      const sim = this.lineSimilarity(line, searchStr);
      if (sim > bestSim) {
        bestSim = sim;
        bestLine = line;
      }
    }

    if (bestLine && bestSim >= minSim) {
      return { match: bestLine };
    }

    // Provide suggestion if we found something close
    if (bestLine && bestSim >= 0.5) {
      const lineIdx = lines.indexOf(bestLine);
      return {
        match: null,
        suggestion: `Did you mean line ${lineIdx + 1}? Found: "${bestLine.trim().substring(0, 50)}${bestLine.trim().length > 50 ? '...' : ''}"`
      };
    }

    return { match: null };
  }
}
