/**
 * Discord Slash Command Registration
 *
 * Provides command definitions and registration functionality.
 * Uses native fetch API for Cloudflare Workers compatibility.
 *
 * CLI Usage:
 *   # Register globally (takes up to 1 hour to propagate)
 *   npx tsx src/commands/register.ts <token> <applicationId>
 *
 *   # Register for a specific guild (instant)
 *   npx tsx src/commands/register.ts <token> <applicationId> <guildId>
 *
 * Worker Usage:
 *   Access /api/register-commands?password=<SETUP_PASSWORD> after deployment
 */

/**
 * Application command type for registration
 */
interface ApplicationCommand {
  name: string;
  description: string;
  description_localizations?: Record<string, string>;
  options?: ApplicationCommandOption[];
}

interface ApplicationCommandOption {
  name: string;
  description: string;
  description_localizations?: Record<string, string>;
  type: number;
  required?: boolean;
}

/**
 * Slash command definitions
 *
 * @see https://discord.com/developers/docs/interactions/application-commands#application-command-object
 */
const commands: ApplicationCommand[] = [
  {
    name: 'chat',
    description: 'Chat with Firela Bot',
    description_localizations: {
      'zh-CN': '\u4E0E Firela Bot \u5BF9\u8BDD',
    },
    options: [
      {
        name: 'message',
        description: 'Your message',
        description_localizations: {
          'zh-CN': '\u4F60\u7684\u6D88\u606F',
        },
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: 'help',
    description: 'Get help information',
    description_localizations: {
      'zh-CN': '\u83B7\u53D6\u5E2E\u52A9\u4FE1\u606F',
    },
  },
];

/**
 * Get command definitions (for display purposes)
 *
 * @returns Array of command definitions
 */
export function getCommandsDefinition(): ApplicationCommand[] {
  return commands;
}

/**
 * Registers slash commands with Discord using native fetch
 *
 * @param token - Discord bot token
 * @param applicationId - Discord application ID
 * @param guildId - Optional guild ID for guild-specific commands
 */
export async function registerCommands(
  token: string,
  applicationId: string,
  guildId?: string
): Promise<void> {
  const url = guildId
    ? `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${applicationId}/commands`;

  try {
    console.log(`Started refreshing application commands...`);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Discord API error: ${response.status} - ${error}`);
    }

    console.log(
      `Successfully registered commands ${guildId ? `for guild ${guildId}` : 'globally'}`
    );
    console.log('\nRegistered commands:');
    commands.forEach((cmd) => {
      console.log(`  /${cmd.name} - ${cmd.description}`);
    });
  } catch (error) {
    console.error('Failed to register commands:', error);
    throw error;
  }
}

/**
 * Deletes all commands (useful for cleanup)
 *
 * @param token - Discord bot token
 * @param applicationId - Discord application ID
 * @param guildId - Optional guild ID for guild-specific commands
 */
export async function deleteCommands(
  token: string,
  applicationId: string,
  guildId?: string
): Promise<void> {
  const url = guildId
    ? `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${applicationId}/commands`;

  try {
    console.log('Deleting all application commands...');

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([]),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Discord API error: ${response.status} - ${error}`);
    }

    console.log('Successfully deleted all commands');
  } catch (error) {
    console.error('Failed to delete commands:', error);
    throw error;
  }
}

// CLI entry point (for Node.js environment)
// Declare process for Node.js CLI usage (tsconfig only includes @cloudflare/workers-types)
declare const process: { argv: string[]; exit: (code: number) => never } | undefined;
if (typeof process !== 'undefined' && process.argv[1]?.includes('register')) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'delete') {
    const [, token, applicationId, guildId] = args;
    if (!token || !applicationId) {
      console.error('Usage: npx tsx register.ts delete <token> <applicationId> [guildId]');
      process.exit(1);
    }
    deleteCommands(token, applicationId, guildId);
  } else {
    const [token, applicationId, guildId] = args;
    if (!token || !applicationId) {
      console.error('Usage: npx tsx register.ts <token> <applicationId> [guildId]');
      console.error('       npx tsx register.ts delete <token> <applicationId> [guildId]');
      process.exit(1);
    }
    registerCommands(token, applicationId, guildId);
  }
}
