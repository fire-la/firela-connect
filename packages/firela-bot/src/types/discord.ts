/**
 * Discord API Types
 *
 * Type definitions for Discord interaction objects.
 * @see https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object
 */

/**
 * Interaction types from Discord API
 * @see https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object-interaction-type
 */
export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
} as const;

/**
 * Response types for Discord interactions
 * @see https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-response-object-interaction-callback-type
 */
export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
  APPLICATION_COMMAND_AUTOCOMPLETE_RESULT: 8,
  MODAL: 9,
} as const;

/**
 * Button component styles
 * @see https://discord.com/developers/docs/interactions/message-components#button-object-button-styles
 */
export const ButtonStyle = {
  PRIMARY: 1, // Blurple
  SECONDARY: 2, // Grey
  SUCCESS: 3, // Green
  DANGER: 4, // Red
  LINK: 5, // External link
} as const;

/**
 * Component types for message components
 * @see https://discord.com/developers/docs/interactions/message-components#component-types
 */
export const ComponentType = {
  ACTION_ROW: 1,
  BUTTON: 2,
  STRING_SELECT: 3,
  TEXT_INPUT: 4,
} as const;

/**
 * Custom IDs for chat buttons
 */
export const ChatButtonCustomId = {
  CONTINUE: 'chat_continue',
  CLEAR: 'chat_clear',
  MODAL_SUBMIT: 'chat_modal_submit',
} as const;

/**
 * Discord Interaction object structure
 * @see https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object
 */
export interface DiscordInteraction {
  id: string;
  application_id: string;
  type: typeof InteractionType[keyof typeof InteractionType];
  data?: {
    id: string;
    name: string;
    type: number;
    options?: Array<{
      name: string;
      type: number;
      value: string;
    }>;
    // Button/Select Menu interaction data
    custom_id?: string;
    component_type?: number;
    // Modal submit data
    components?: Array<{
      type: number;
      components: Array<{
        type: number;
        custom_id: string;
        value: string;
      }>;
    }>;
    // Resolved data for slash commands
    resolved?: {
      values?: string[];
    };
  };
  guild_id?: string;
  channel_id: string;
  user: {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string;
  };
  member?: {
    user: DiscordInteraction['user'];
    roles: string[];
    permissions: string;
  };
  token: string;
  version: number;
  message?: {
    id: string;
    content: string;
  };
  app_permissions: string;
  locale?: string;
  guild_locale?: string;
}
