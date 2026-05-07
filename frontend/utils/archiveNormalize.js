const COMMUNITY_ARCHIVE_RAW = 'https://raw.githubusercontent.com/ruanrrn/ipa-archive/main'

export const normalizeArchiveList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.apps)) return payload.apps
  return []
}

export const normalizeVersion = (version) => {
  const versionId = String(
    version?.version_id
    ?? version?.appVersionId
    ?? version?.external_identifier
    ?? version?.id
    ?? ''
  )
  const label = String(
    version?.version
    ?? version?.bundle_version
    ?? version?.name
    ?? versionId
  )
  if (!versionId && !label) return null
  return {
    version_id: versionId,
    external_identifier: String(version?.external_identifier ?? versionId),
    version: label,
    bundle_version: label,
    description: version?.description || '',
    size_bytes: version?.size_bytes ?? version?.size ?? null,
    released_at: version?.released_at ?? version?.created_at ?? null,
    source: version?.source || ''
  }
}

export const getArchiveKey = (app) => {
  const id = String(app?.id ?? app?.app_id ?? app?.trackId ?? '')
  const bundleId = app?.bundle_id ?? app?.bundleId ?? ''
  const kind = app?.delisted ? 'delisted' : 'fav'
  return `${kind}:${id}:${bundleId}`
}

export const normalizeArchiveApp = (app, delisted = false) => {
  const iconAsset = app?.icon_asset ?? ''
  const resolvedIconUrl = (app?.icon_url ?? app?.artworkUrl ?? app?.artworkUrl100 ?? app?.artworkUrl60 ?? '') || (iconAsset ? `${COMMUNITY_ARCHIVE_RAW}/${iconAsset}` : '')
  const normalized = {
    id: String(app?.id ?? app?.app_id ?? app?.trackId ?? ''),
    name: app?.name ?? app?.app_name ?? app?.trackName ?? '未知应用',
    icon_url: resolvedIconUrl,
    icon_asset: iconAsset,
    bundle_id: app?.bundle_id ?? app?.bundleId ?? '',
    artist_name: app?.artist_name ?? app?.artistName ?? '',
    versions: Array.isArray(app?.versions) ? app.versions.map(normalizeVersion).filter(Boolean) : [],
    latest_version: app?.latest_version ?? '',
    delisted: app?.delisted ?? delisted,
    added_at: app?.added_at ?? app?.updated_at ?? app?.created_at ?? '',
    added_by: app?.added_by ?? '',
    notes: Array.isArray(app?.notes) ? app.notes : [],
    note: app?.note || ''
  }
  normalized.archive_key = getArchiveKey(normalized)
  return normalized
}

export const normalizeDelistedPayload = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.apps)) return payload.apps
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

export const normalizeCandidateApp = (app) => {
  const normalized = normalizeArchiveApp(app, true)
  normalized.already_archived_locally = Boolean(app?.already_archived_locally)
  return normalized
}

export const sortVersionsDesc = (items) => [...items].sort((a, b) => String(b.version).localeCompare(String(a.version), undefined, { numeric: true, sensitivity: 'base' }))
