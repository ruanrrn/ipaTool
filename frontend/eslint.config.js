import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      }
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'off',
      'no-empty': 'off',
      'vue/no-unused-vars': 'warn',
      'vue/require-v-for-key': 'warn',
      'vue/no-unused-components': 'warn',
    }
  },
  {
    ignores: ['../dist/**', '../node_modules/**', '../server/**']
  }
]
