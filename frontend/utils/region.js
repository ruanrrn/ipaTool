/**
 * Shared region utilities for ipaTool
 */

export const REGION_MAP = {
  US: '🇺🇸 US',
  CN: '🇨🇳 CN',
  JP: '🇯🇵 JP',
  GB: '🇬🇧 GB',
  DE: '🇩🇪 DE',
  FR: '🇫🇷 FR',
  CA: '🇨🇦 CA',
  AU: '🇦🇺 AU',
  KR: '🇰🇷 KR',
  IN: '🇮🇳 IN',
  BR: '🇧🇷 BR',
  RU: '🇷🇺 RU',
  SG: '🇸🇬 SG',
  HK: '🇭🇰 HK',
  TW: '🇹🇼 TW',
}

/**
 * Format a region code to a display label with flag emoji.
 * Falls back to the raw region code if unknown.
 */
export function formatRegion(region) {
  return REGION_MAP[region] || region || 'US'
}
