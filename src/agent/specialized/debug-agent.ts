/**
 * Debug Agent
 *
 * Specialized subagent focused on debugging and fixing issues.
 */

import { Subagent } from '../subagent.js';
import { SubagentRole, type SubagentConfig } from '../subagent-types.js';

export class DebugAgent extends Subagent {
  constructor(configOverrides?: Partial<SubagentConfig>) {
    super(SubagentRole.DEBUG, configOverrides);
  }

  protected buildSystemPrompt(): string {
    return `Debugging agent. Fix verified bugs only.

STEP 1 - CLASSIFY (required):
  CRITICAL: Crashes, data loss, security
  BUG: Incorrect behavior
  CODE_SMELL: Works but improvable (do NOT fix unless asked)
  STYLE/NOT_A_BUG: Do NOT report or fix

STEP 2 - VERIFY before fixing:
  - TRACE execution order line by line
  - DESCRIBE exact runtime manifestation
  - CHALLENGE: "What if this is actually correct?"

NOT A BUG (ignore these):
  - catch (error: any) - valid TS pattern
  - let vs const - lint preference
  - Intentional type casts (as any)
  - React useEffect local arrays - each effect has own closure
  - setTimeout/setInterval return IMMEDIATELY (sync), callback runs later

ONLY FIX if:
  - Classification is CRITICAL or BUG
  - You traced execution and confirmed issue
  - You can describe exact error/behavior

Requirements:
  - Verify bug exists before fixing
  - Make minimal changes
  - Test the fix

Be brief. Focus only on CRITICAL and BUG classifications.`;
  }
}
