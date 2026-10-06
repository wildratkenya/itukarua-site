// Re-encode oversized stored images down to card-appropriate size.
//
// Why this exists: optimizeImageUrl emits ?width=400&quality=80&format=webp on
// /storage/v1/object/public/, but Supabase only honours those on
// /storage/v1/render/image/, which answers 403 on the current plan. Measured
// 2026-10-03, one job image is 12,399,934 bytes with and without the params.
// Total across every reachable image row was 51.8 MB for 14 images.
//
// This shrinks the stored originals so the single stored copy is right-sized,
// rather than depending on a CDN transform that is not available.
//
// Safety:
//   * dry run by default. Writes only happen with --apply.
//   * originals are never deleted or overwritten; each conversion lands on a
//     new object path and the database row is repointed to it.
//   * a row is updated only after the replacement has been uploaded and its
//     size verified, so a failure mid-run leaves rows pointing at files that
//     still exist.
//   * non-image objects (the adverts bucket allows application/pdf for
//     certificates) are skipped by extension and by content type.
//
// Usage:
//   node scripts/backfill-image-sizes.mjs
//   node scripts/backfill-image-sizes.mjs --tables=jobs,service_ads,advertisements,profiles
//   node scripts/backfill-image-sizes.mjs --apply
//
// Flags:
//   --apply          perform writes (otherwise a dry run)
//   --tables=a,b     which tables to process, comma separated
//   --max-edge=N     longest edge in px for the stored copy (default 1200,
//                    matching the largest size the app requests)
//   --target-kb=N    step quality down until under this (default 200)
//   --min-kb=N       only consider images already larger than this (default 400)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

// ─── args ───────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=')[1] : fallback
}
const APPLY = argv.includes('--apply')

const MAX_EDGE = Number(flag('max-edge', 1200))
const TARGET_BYTES = Number(flag('target-kb', 200)) * 1024
const MIN_BYTES = Number(flag('min-kb', 400)) * 1024
const TABLES = flag('tables', 'jobs,service_ads').split(',').map((s) => s.trim()).filter(Boolean)

// ─── env ────────────────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const raw = readFileSync('.env', 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    /* .env optional, real env vars win */
  }
}
loadEnv()

const URL_BASE = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || ''

if (!URL_BASE) throw new Error('VITE_SUPABASE_URL not set')

// A dry run only needs to read rows and HEAD public objects, so the anon key is
// enough for the tables that are publicly readable. Writing requires the
// service role, so that is only demanded for --apply.
if (APPLY && !SERVICE_KEY) {
  console.error(
    'SUPABASE_SERVICE_ROLE_KEY is not set, and --apply needs it to write.\n' +
      'Add it to .env from Supabase -> Project Settings -> API Keys.\n' +
      'It must NOT be VITE_ prefixed or Vite will bundle it into the client.',
  )
  process.exit(1)
}
if (!SERVICE_KEY && !ANON_KEY) throw new Error('no Supabase key available')

const sb = createClient(URL_BASE, SERVICE_KEY || ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const STORAGE_PREFIX = `${URL_BASE}/storage/v1/object/public/`

// ─── table/column shape ─────────────────────────────────────────────────────

const SHAPE = {
  jobs: [{ col: 'images', kind: 'array' }],
  service_ads: [
    { col: 'image', kind: 'string' },
    { col: 'images', kind: 'array' },
  ],
  advertisements: [
    { col: 'image_url', kind: 'string' },
    { col: 'images', kind: 'array' },
  ],
  profiles: [
    { col: 'profile_image', kind: 'string' },
    { col: 'certificates', kind: 'array', skipNonImage: true },
  ],
  portfolio_sites: [{ col: 'image_url', kind: 'string' }],
}

const isImageish = (u) =>
  /\.(jpe?g|png|webp|gif|bmp|avif|tiff?)$/i.test(u.split('?')[0])

// ─── helpers ────────────────────────────────────────────────────────────────

function parseUrl(u) {
  if (!u || !u.startsWith(STORAGE_PREFIX)) return null
  const path = u.substring(STORAGE_PREFIX.length)
  const slash = path.indexOf('/')
  if (slash <= 0) return null
  return { bucket: path.slice(0, slash), path: path.slice(slash + 1) }
}

async function headSize(u) {
  const res = await fetch(u, { method: 'HEAD' })
  if (!res.ok) throw new Error(`HEAD ${res.status}`)
  const len = Number(res.headers.get('content-length'))
  if (!Number.isFinite(len) || len <= 0) throw new Error('no content-length')
  return { bytes: len, type: res.headers.get('content-type') || '' }
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`
const kb = (n) => `${Math.round(n / 1024)} KB`

// ─── collect ────────────────────────────────────────────────────────────────

console.log(`mode            ${APPLY ? 'APPLY (writes)' : 'DRY RUN (no writes)'}`)
console.log(`access          ${SERVICE_KEY ? 'service role' : 'anon key (read only)'}`)
console.log(`tables          ${TABLES.join(', ')}`)
console.log(`max edge        ${MAX_EDGE}px`)
console.log(`target          <= ${kb(TARGET_BYTES)}`)
console.log(`only if larger   > ${kb(MIN_BYTES)}`)
console.log('')

const rowsByTable = new Map()
const candidates = new Map() // url -> { bucket, path, bytes, type, refs: [] }

for (const table of TABLES) {
  const cols = SHAPE[table]
  if (!cols) {
    console.log(`skip ${table}: unknown table`)
    continue
  }
  const names = cols.map((c) => c.col).join(',')
  const { data, error } = await sb.from(table).select(`id,${names}`)
  if (error) {
    // A rejected key would otherwise make every table skip and the run would
    // report a clean zero-sized result, which is the worst possible failure mode
    // for a migration.
    if (/api key|jwt|permission|row-level|401|403|42501/i.test(error.message)) {
      throw new Error(
        `reading ${table} failed on access: ${error.message}\n` +
          'Check that the key is a valid service_role key for this project.',
      )
    }
    console.log(`skip ${table}: ${error.message}`)
    continue
  }
  rowsByTable.set(table, { cols, rows: data })

  for (const row of data) {
    for (const { col, kind, skipNonImage } of cols) {
      const val = row[col]
      const list = kind === 'array' ? (Array.isArray(val) ? val : []) : val ? [val] : []
      for (const u of list) {
        const p = parseUrl(u)
        if (!p) continue
        if (skipNonImage && !isImageish(u)) continue
        if (candidates.has(u)) {
          candidates.get(u).refs.push(`${table}.${col}#${row.id}`)
          continue
        }
        candidates.set(u, { ...p, url: u, bytes: 0, type: '', refs: [`${table}.${col}#${row.id}`] })
      }
    }
  }
}

console.log(`found ${candidates.size} distinct stored images across ${TABLES.length} table(s)\n`)

// ─── measure and filter ─────────────────────────────────────────────────────

let totalBefore = 0
let totalAfter = 0
let skipped = 0
const work = []

for (const c of candidates.values()) {
  try {
    const { bytes, type } = await headSize(c.url)
    c.bytes = bytes
    c.type = type
    totalBefore += bytes
    if (bytes <= MIN_BYTES) {
      skipped++
      continue
    }
    if (/application\/pdf/i.test(type) || /\.pdf$/i.test(c.url)) {
      skipped++
      continue
    }
    work.push(c)
  } catch (e) {
    c.error = e.message
  }
}

console.log(`already small   ${skipped} (skipped)`)
console.log(`to convert      ${work.length}`)
console.log(`before          ${mb(totalBefore)}`)
console.log('')

// ─── pre-flight backup, written before any mutation ─────────────────────────
// The conversion record at the end of this script is not a backup: it only
// exists once rows have already been repointed. This snapshot is the thing that
// makes the run reversible, so it is captured up front and covers every row in
// scope whether or not it ends up being converted.

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
mkdirSync('backups', { recursive: true })

const preflightPath = `backups/image-backfill-PREFLIGHT-${stamp}.json`
writeFileSync(
  preflightPath,
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      purpose: 'pre-mutation snapshot of every image-bearing row in scope',
      restore: "for each row, write columns[].old_value back to the row with .eq('id', id)",
      settings: { max_edge: MAX_EDGE, target_kb: TARGET_BYTES / 1024, min_kb: MIN_BYTES / 1024, tables: TABLES },
      rows: [...rowsByTable.entries()].map(([table, { cols, rows }]) => ({
        table,
        columns: cols.map((c) => c.col),
        rows: rows.map((r) => ({
          id: r.id,
          values: Object.fromEntries(cols.map((c) => [c.col, r[c.col]])),
        })),
      })),
    },
    null,
    2,
  ),
)
console.log(`pre-flight backup written: ${preflightPath}`)
console.log('')

// ─── convert ────────────────────────────────────────────────────────────────

const replacements = new Map() // old url -> new url
const results = []

for (const [i, c] of work.entries()) {
  const label = `[${i + 1}/${work.length}] ${kb(c.bytes).padStart(7)}  ${c.bucket}/${c.path.slice(0, 46)}`

  if (!APPLY) {
    console.log(`${label}  -> would re-encode <=${MAX_EDGE}px, <=${kb(TARGET_BYTES)}`)
    continue
  }

  try {
    const src = await fetch(c.url)
    if (!src.ok) throw new Error(`download ${src.status}`)
    const input = Buffer.from(await src.arrayBuffer())

    // fit:inside preserves aspect ratio, so nothing is cropped for the detail
    // page or the 1200px full-screen viewer.
    let best = null
    for (const quality of [80, 72, 64, 56, 48, 40]) {
      const out = await sharp(input, { failOn: 'none' })
        .rotate()
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality })
        .toBuffer()
      if (!best || out.length < best.length) best = out
      if (out.length <= TARGET_BYTES) break
    }

    const stamp = Date.now()
    const base = c.path.replace(/\.[^./]+$/, '').split('/').pop().slice(0, 40) || 'image'
    const dir = c.path.replace(/\/[^/]+$/, '')
    const newPath = `${dir ? `${dir}/` : ''}opt_${stamp}_${base}.webp`

    const { error: upErr } = await sb.storage
      .from(c.bucket)
      .upload(newPath, best, { contentType: 'image/webp', upsert: false })
    if (upErr) throw upErr(`upload: ${upErr.message}`)

    const newUrl = sb.storage.from(c.bucket).getPublicUrl(newPath).data.publicUrl
    const verified = await headSize(newUrl)
    if (verified.bytes !== best.length) {
      throw new Error(`verify mismatch: stored ${verified.bytes}, sent ${best.length}`)
    }

    const meta = await sharp(best).metadata()
    replacements.set(c.url, newUrl)
    totalAfter += best.length
    const saved = 100 - Math.round((best.length / c.bytes) * 100)
    console.log(
      `${label}  -> ${kb(best.length).padStart(7)}  ${meta.width}x${meta.height}  -${saved}%`,
    )
    results.push({
      table_refs: c.refs,
      bucket: c.bucket,
      old_path: c.path,
      new_path: newPath,
      old_url: c.url,
      new_url: newUrl,
      old_bytes: c.bytes,
      new_bytes: best.length,
      width: meta.width,
      height: meta.height,
    })
  } catch (e) {
    console.error(`${label}  FAILED: ${e.message}`)
    results.push({
      table_refs: c.refs,
      bucket: c.bucket,
      old_path: c.path,
      old_url: c.url,
      old_bytes: c.bytes,
      error: e.message,
    })
  }
}

// ─── repoint rows (only after every upload verified) ─────────────────────────

if (APPLY && replacements.size > 0) {
  console.log('\nrepointing rows...')
  for (const [table, { cols, rows }] of rowsByTable) {
    let touched = 0
    for (const row of rows) {
      const patch = {}
      let dirty = false
      for (const { col, kind } of cols) {
        const val = row[col]
        if (kind === 'array') {
          if (!Array.isArray(val)) continue
          const next = val.map((u) => replacements.get(u) ?? u)
          if (next.some((u, i) => u !== val[i])) {
            patch[col] = next
            dirty = true
          }
        } else {
          if (!val) continue
          const next = replacements.get(val)
          if (next) {
            patch[col] = next
            dirty = true
          }
        }
      }
      if (dirty) {
        const { error } = await sb.from(table).update(patch).eq('id', row.id)
        if (error) console.error(`  ${table}#${row.id}: ${error.message}`)
        else touched++
      }
    }
    if (touched) console.log(`  ${table}: ${touched} row(s) repointed`)
  }
}

// ─── manifest ───────────────────────────────────────────────────────────────

const stamp2 = new Date().toISOString().replace(/[:.]/g, '-')
const manifestPath = `backups/image-backfill-run-${stamp2}.json`
writeFileSync(
  manifestPath,
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      applied: APPLY,
      settings: { max_edge: MAX_EDGE, target_kb: TARGET_BYTES / 1024, min_kb: MIN_BYTES / 1024, tables: TABLES },
      originals_kept: true,
      totals: {
        images_found: candidates.size,
        converted: replacements.size,
        skipped_small_or_non_image: skipped,
        bytes_before: totalBefore,
        bytes_after_applied: totalAfter,
        bytes_after_if_applied: work.length * TARGET_BYTES,
      },
      reversibility: 'swap new_url back to old_url in each row; original objects were never deleted',
      conversions: results,
    },
    null,
    2,
  ),
)

console.log('')
if (APPLY) {
  const actual = results.filter((r) => !r.error).reduce((s, r) => s + r.new_bytes, 0)
  console.log(`converted        ${replacements.size}`)
  console.log(`failures         ${results.filter((r) => r.error).length}`)
  console.log(`before           ${mb(totalBefore)}`)
  console.log(`after            ${mb(actual)}`)
  console.log(`saved            ${mb(totalBefore - actual)}`)
} else {
  console.log(`before           ${mb(totalBefore)}`)
  console.log(`after (estimate) ${mb(work.length * TARGET_BYTES)}`)
  console.log(`saved (estimate) ${mb(totalBefore - work.length * TARGET_BYTES)}`)
}
console.log(`manifest         ${manifestPath}`)
console.log(APPLY ? '' : '\nre-run with --apply to perform the conversion')