# 下载页面改进说明

## 问题背景

### 原有问题
1. **搜索区域不一致** - 用户可以直接搜索应用，但搜索使用的区域（固定为 CN）可能与账号区域不一致
2. **缺少账号验证** - 没有强制要求先选择账号，可能导致后续下载失败
3. **用户体验不佳** - 没有明确提示用户需要先登录账号

### 改进目标
- ✅ 强制要求先选择账号才能搜索
- ✅ 默认自动选择第一个账号
- ✅ 根据所选账号的区域进行搜索
- ✅ 提供清晰的视觉反馈和引导

---

## 实现的改进

### 1. 账号选择前置

**改进前**：用户可以直接搜索应用，搜索区域固定为 CN，账号选择是可选的

**改进后**：
- 未登录时显示橙色警告框，禁用搜索功能
- 提供"前往登录"按钮，直接跳转到账号标签页
- 已登录时自动选择第一个账号，显示搜索区域提示

### 2. 自动选择第一个账号

```javascript
// 监听账号变化，自动选择第一个
watch(accounts, () => {
  autoSelectFirstAccount()
}, { deep: true, immediate: true })
```

### 3. 区域感知搜索

```javascript
// 根据所选账号的区域动态调整
const account = accounts.value[selectedAccount.value]
const region = account?.region || 'US'

const response = await fetch(
  `https://itunes.apple.com/search?term=${query}&country=${region}&media=software&limit=10`
)
```

### 4. 视觉反馈优化

- 显示当前搜索区域（如：🇨🇳 CN、🇺🇸 US）
- 实时更新账号选择提示
- 清晰的状态提示和错误信息

---

## 用户流程对比

### 改进前
```
进入下载页 → 直接搜索（固定 CN） → 选择应用 → 选择账号 → 可能失败
```

### 改进后
```
进入下载页 → 提示登录 → 登录账号 → 自动选择第一个 → 显示区域 → 搜索（使用账号区域） → 下载成功
```

---

## 技术细节

### 区域映射
```javascript
const getRegionLabel = (region) => {
  const regionMap = {
    'US': '🇺🇸 US', 'CN': '🇨🇳 CN', 'JP': '🇯🇵 JP',
    'GB': '🇬🇧 GB', 'DE': '🇩🇪 DE', 'FR': '🇫🇷 FR',
    'CA': '🇨🇦 CA', 'AU': '🇦🇺 AU'
  }
  return regionMap[region] || region
}
```

### 区域自动检测
- 中国区邮箱（@qq.com、@163.com 等）→ CN
- 其他邮箱（@icloud.com、@gmail.com 等）→ US
- 登录成功后根据 Apple ID 响应调整

---

## 优势总结

1. **用户体验** - 清晰的引导流程，避免混淆
2. **数据准确性** - 确保搜索和下载区域一致
3. **错误预防** - 提前验证，减少后续错误
4. **自动化** - 自动选择第一个账号，减少操作步骤
5. **视觉反馈** - 实时显示当前搜索区域
