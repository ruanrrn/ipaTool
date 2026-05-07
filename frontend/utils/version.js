export const normalizeComparableValue = (value) => String(value ?? '').trim().toLowerCase()

export const normalizeVersionSize = (version) => {
  const rawSize = version?.size
    ?? version?.fileSizeBytes
    ?? version?.size_bytes
    ?? version?.bundleSizeBytes
    ?? version?.downloadSize
    ?? version?.download_size
    ?? version?.file_size
    ?? version?.appSize
    ?? version?.app_size
    ?? 0

  const parsedSize = Number(rawSize)
  return Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : 0
}

export const getVersionId = (version) => String(
  version?.external_identifier
  ?? version?.version_id
  ?? version?.appVersionId
  ?? version?.id
  ?? ''
)

export const getVersionLabel = (version, fallback = '') => String(
  version?.bundle_version
  ?? version?.version
  ?? version?.name
  ?? fallback
  ?? ''
)

export const normalizeFetchedVersion = (version) => {
  const versionId = getVersionId(version)
  const label = getVersionLabel(version, versionId)

  if (!versionId || !label) return null

  return {
    ...version,
    external_identifier: versionId,
    version_id: String(version?.version_id ?? versionId),
    bundle_version: label,
    version: String(version?.version ?? label),
    created_at: version?.created_at ?? version?.released_at ?? version?.date ?? '',
    released_at: version?.released_at ?? version?.created_at ?? version?.date ?? '',
    size: normalizeVersionSize(version),
    size_bytes: version?.size_bytes ?? normalizeVersionSize(version),
    source: version?.source || ''
  }
}

export const createManualVersion = (versionId) => {
  const normalizedId = String(versionId ?? '').trim()
  if (!normalizedId) return null

  return {
    external_identifier: normalizedId,
    version_id: normalizedId,
    bundle_version: normalizedId,
    name: normalizedId,
    is_manual: true,
    created_at: '',
    size: 0
  }
}

export const upsertManualVersion = (versions, versionId) => {
  const manualVersion = createManualVersion(versionId)
  if (!manualVersion) return Array.isArray(versions) ? [...versions] : []

  const existing = Array.isArray(versions) ? versions : []
  const manualId = getVersionId(manualVersion)
  const withoutDuplicate = existing.filter((item) => getVersionId(item) !== manualId)
  return [manualVersion, ...withoutDuplicate]
}

export const getVersionMatchScore = ({
  currentVersionExactId,
  currentVersionLabel,
  versionId,
  versionLabel
}) => {
  const normalizedVersionId = normalizeComparableValue(versionId)
  const normalizedVersionLabel = normalizeComparableValue(versionLabel)

  if (currentVersionExactId) {
    if (normalizedVersionId && normalizedVersionId === currentVersionExactId) return 4
    if (!normalizedVersionId && currentVersionLabel && normalizedVersionLabel === currentVersionLabel) return 1
    return -1
  }

  if (currentVersionLabel && normalizedVersionLabel === currentVersionLabel) return 2
  return -1
}

export const compareVersionDesc = (a, b) => {
  const normalize = (value) => String(value || '')
    .split(/[^0-9A-Za-z]+/)
    .filter(Boolean)
    .map(part => (/^\d+$/.test(part) ? Number(part) : part.toLowerCase()))

  const av = normalize(a?.bundle_version || a?.version)
  const bv = normalize(b?.bundle_version || b?.version)
  const len = Math.max(av.length, bv.length)

  for (let i = 0; i < len; i += 1) {
    const left = av[i]
    const right = bv[i]
    if (left === undefined) return 1
    if (right === undefined) return -1
    if (left === right) continue
    if (typeof left === 'number' && typeof right === 'number') {
      return right - left
    }
    return String(right).localeCompare(String(left), undefined, { numeric: true, sensitivity: 'base' })
  }

  return String(b?.created_at || b?.date || '').localeCompare(String(a?.created_at || a?.date || ''))
}
