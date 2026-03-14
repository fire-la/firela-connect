/**
 * Chinese (Simplified) translations for Firela-Bot
 */
export default {
  errors: {
    invalid_api_key: 'API Key 无效，请检查配置',
    api_key_expired: 'API Key 已过期，请访问 firela.io 更新',
    rate_limit_exceeded: '请求过于频繁，请稍后重试',
    insufficient_quota: '配额不足，请升级计划',
    service_unavailable: '服务暂时不可用，请稍后再试',
    internal_error: '服务错误: {message}',
    connection_failed: '连接失败: {message}',
    connection_failed_generic: '连接失败，请稍后重试',
    request_timeout: '请求超时，请稍后重试',
    connection_verify_failed: '连接验证失败',
  },
  buttons: {
    continue_chat: '继续对话',
    clear_context: '清除上下文',
  },
  modals: {
    continue_title: '继续对话',
    input_label: '输入你的问题',
    input_placeholder: '在这里输入你想问的内容...',
  },
  validation: {
    provide_message: '请提供消息内容',
    no_input_received: '未收到输入内容',
  },
  responses: {
    llm_fallback: '抱歉，我无法生成回复。',
    context_cleared: '对话上下文已清除，可以开始新的对话了！',
    unknown_button: '未知的按钮操作',
  },
  commands: {
    chat_description: '与 Firela Bot 对话',
    chat_message_option: '你的消息',
    help_description: '获取帮助信息',
  },
} as const;
