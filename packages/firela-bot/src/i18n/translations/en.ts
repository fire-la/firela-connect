/**
 * English translations for Firela-Bot
 */
export default {
  errors: {
    invalid_api_key: 'Invalid API key. Please check your configuration.',
    api_key_expired: 'API key expired. Please visit firela.io to update.',
    rate_limit_exceeded: 'Too many requests. Please try again later.',
    insufficient_quota: 'Insufficient quota. Please upgrade your plan.',
    service_unavailable: 'Service temporarily unavailable. Please try again later.',
    internal_error: 'Service error: {message}',
    connection_failed: 'Connection failed: {message}',
    connection_failed_generic: 'Connection failed. Please try again later.',
    request_timeout: 'Request timed out. Please try again later.',
    connection_verify_failed: 'Connection verification failed.',
  },
  buttons: {
    continue_chat: 'Continue Chat',
    clear_context: 'Clear Context',
  },
  modals: {
    continue_title: 'Continue Chat',
    input_label: 'Your Question',
    input_placeholder: 'Enter your question here...',
  },
  validation: {
    provide_message: 'Please provide a message.',
    no_input_received: 'No input received.',
  },
  responses: {
    llm_fallback: 'Sorry, I could not generate a response.',
    context_cleared: 'Conversation context cleared. Ready for a new chat!',
    unknown_button: 'Unknown button action.',
  },
  commands: {
    chat_description: 'Chat with Firela Bot',
    chat_message_option: 'Your message',
    help_description: 'Get help information',
  },
} as const;
