/**
 * localStorage key 常量定义
 * 统一管理所有 localStorage 键名，避免硬编码字符串
 */

export const STORAGE_KEYS = {
  // 账号相关
  ACCOUNTS: 'ipa_accounts',
  SELECTED_ACCOUNT_INDEX: 'ipa_selected_account_index',
  SELECTED_ACCOUNT_KEY: 'ipa_selected_account_key',

  // 外观设置
  DARK_MODE: 'appearance-dark-mode',
  ACCENT_COLOR: 'appearance-accent-color',

  // 通知设置
  NOTIFICATION_SETTINGS: 'ipa_notification_settings',

  // 暗色模式（独立的 darkMode key）
  DARK_MODE_LEGACY: 'darkMode'
}

export default STORAGE_KEYS
