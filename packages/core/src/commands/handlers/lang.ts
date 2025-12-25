/**
 * Language Command Handler
 *
 * Handler for /lang - display and switch languages
 *
 * @packageDocumentation
 */

import type { CommandDefinition, CommandContext, CommandResult } from "../types.js";
import { getTranslations, setCurrentLanguage, resetCachedLanguage } from "../../ui/hooks/use-translations.js";
import { getSupportedLanguages, type SupportedLanguage } from "../../i18n/loader.js";

// Language display names - native names with English hints
const LANGUAGE_DISPLAY_NAMES: Record<SupportedLanguage, { label: string; hint: string }> = {
  en: { label: "English", hint: "Default language" },
  "zh-CN": { label: "简体中文", hint: "Simplified Chinese" },
  "zh-TW": { label: "繁體中文", hint: "Traditional Chinese" },
  ja: { label: "日本語", hint: "Japanese" },
  ko: { label: "한국어", hint: "Korean" },
  th: { label: "ไทย", hint: "Thai" },
  vi: { label: "Tiếng Việt", hint: "Vietnamese" },
  de: { label: "Deutsch", hint: "German" },
  fr: { label: "Français", hint: "French" },
  es: { label: "Español", hint: "Spanish" },
  pt: { label: "Português", hint: "Portuguese" },
};

/**
 * /lang command handler
 *
 * Usage:
 *   /lang           - Show current language and list available
 *   /lang <code>    - Switch to the specified language
 */
export async function handleLang(
  args: string,
  _ctx: CommandContext
): Promise<CommandResult> {
  try {
    const { cmd, language: currentLang } = getTranslations();
    const arg = args.trim().toLowerCase();
    const supportedLanguages = getSupportedLanguages();

    if (!arg) {
      // Show current language and available options
      let content = `**${cmd.lang.title}**\n\n`;
      content += `${cmd.lang.currentLanguage}: ${LANGUAGE_DISPLAY_NAMES[currentLang].label} (${currentLang})\n\n`;
      content += `**${cmd.lang.availableLanguages}:**\n`;

      for (const code of supportedLanguages) {
        const display = LANGUAGE_DISPLAY_NAMES[code];
        const marker = code === currentLang ? ` (${cmd.lang.current})` : "";
        content += `   \`${code.padEnd(6)}\` ${display.label} - ${display.hint}${marker}\n`;
      }

      content += `\n${cmd.lang.usage}`;

      return {
        handled: true,
        entries: [
          {
            type: "assistant",
            content,
            timestamp: new Date(),
          },
        ],
        clearInput: true,
      };
    }

    // Normalize language code (handle common aliases and case-insensitive matching)
    let normalizedLang = arg;

    // First, try case-insensitive match against supported languages
    const caseInsensitiveMatch = supportedLanguages.find(
      lang => lang.toLowerCase() === arg.toLowerCase()
    );
    if (caseInsensitiveMatch) {
      normalizedLang = caseInsensitiveMatch;
    } else {
      // Handle common aliases
      if (arg === 'zh' || arg === 'chinese') normalizedLang = 'zh-CN';
      else if (arg === 'tw' || arg === 'traditional') normalizedLang = 'zh-TW';
      else if (arg === 'jp' || arg === 'japanese') normalizedLang = 'ja';
      else if (arg === 'kr' || arg === 'korean') normalizedLang = 'ko';
      else if (arg === 'thai') normalizedLang = 'th';
      else if (arg === 'vietnamese') normalizedLang = 'vi';
      else if (arg === 'english') normalizedLang = 'en';
      else if (arg === 'german' || arg === 'deutsch') normalizedLang = 'de';
      else if (arg === 'french' || arg === 'français' || arg === 'francais') normalizedLang = 'fr';
      else if (arg === 'spanish' || arg === 'español' || arg === 'espanol') normalizedLang = 'es';
      else if (arg === 'portuguese' || arg === 'português' || arg === 'portugues') normalizedLang = 'pt';
    }

    // Check if language code is valid
    if (!supportedLanguages.includes(normalizedLang as SupportedLanguage)) {
      const available = supportedLanguages.join(", ");
      return {
        handled: true,
        entries: [
          {
            type: "assistant",
            content: `${cmd.lang.unknownLanguage}: \`${arg}\`\n\nAvailable: ${available}`,
            timestamp: new Date(),
          },
        ],
        clearInput: true,
      };
    }

    // Switch language
    const newLang = normalizedLang as SupportedLanguage;

    if (newLang === currentLang) {
      const display = LANGUAGE_DISPLAY_NAMES[newLang];
      return {
        handled: true,
        entries: [
          {
            type: "assistant",
            content: `${cmd.lang.currentLanguage}: ${display.label} (${newLang})`,
            timestamp: new Date(),
          },
        ],
        clearInput: true,
      };
    }

    // Set the new language
    setCurrentLanguage(newLang);
    resetCachedLanguage();

    // Get new translations in the new language
    const newTranslations = getTranslations();
    const display = LANGUAGE_DISPLAY_NAMES[newLang];

    // Reminder to restart for full effect
    const restartReminder = "\n\n⚠️ Please restart the CLI (`/exit` then relaunch) for the language change to take full effect.";

    return {
      handled: true,
      entries: [
        {
          type: "assistant",
          content: `${newTranslations.cmd.lang.languageChanged} ${display.label} (${newLang})${restartReminder}`,
          timestamp: new Date(),
        },
      ],
      clearInput: true,
    };
  } catch (error) {
    return {
      handled: true,
      error: `Failed to process language command: ${error instanceof Error ? error.message : "Unknown error"}`,
      clearInput: true,
    };
  }
}

/**
 * Language command definition for registration
 */
export const langCommands: CommandDefinition[] = [
  {
    name: "lang",
    aliases: ["l"],
    description: "View or change display language",
    category: "settings",
    handler: handleLang,
    examples: ["/lang", "/lang ja", "/lang zh-CN", "/l de"],
  },
];
