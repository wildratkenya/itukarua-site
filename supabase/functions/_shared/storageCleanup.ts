import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LEGACY_PUBLIC = '/storage/v1/object/public/adverts/'
const SIGNED_DOCUMENTS = '/storage/v1/object/sign/documents/'

// Profile images are stored as public URLs, certificates as relative paths in the
// private documents bucket. Map both back to (bucket, path) before removing.
export function splitStorageValue(value: string): { bucket: string; path: string } | null {
  if (!value) return null
  const legacy = value.indexOf(LEGACY_PUBLIC)
  if (legacy >= 0) {
    return { bucket: 'adverts', path: decodeURIComponent(value.slice(legacy + LEGACY_PUBLIC.length)) }
  }
  const signed = value.indexOf(SIGNED_DOCUMENTS)
  if (signed >= 0) {
    return { bucket: 'documents', path: decodeURIComponent(value.slice(signed + SIGNED_DOCUMENTS.length).split('?')[0]) }
  }
  if (/^https?:\/\//i.test(value)) return null
  return { bucket: 'documents', path: value }
}

export async function removeStorageObjects(admin: SupabaseClient, values: string[]): Promise<string[]> {
  const grouped = new Map<string, string[]>()
  const failed: string[] = []
  for (const raw of values || []) {
    const parsed = splitStorageValue(String(raw))
    if (!parsed?.path) continue
    const list = grouped.get(parsed.bucket) || []
    list.push(parsed.path)
    grouped.set(parsed.bucket, list)
  }
  for (const [bucket, list] of grouped) {
    const unique = [...new Set(list)]
    for (let i = 0; i < unique.length; i += 100) {
      const chunk = unique.slice(i, i + 100)
      const { error } = await admin.storage.from(bucket).remove(chunk)
      if (error) {
        console.error(`[storage] remove failed in ${bucket}:`, error.message)
        failed.push(...chunk.map((p) => `${bucket}/${p}`))
      }
    }
  }
  return failed
}
