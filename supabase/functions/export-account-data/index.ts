import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeadersFor, isOriginAllowed } from '../_shared/cors.ts'
import { requireUser } from '../_shared/requireUser.ts'

// Kenya DPA s.26 / GDPR Art.15: a member can obtain a copy of their own data.
// Every query is scoped to the verified caller id. Only fields supplied by the
// member are included; database IDs and operational metadata are deliberately
// excluded from the export.

type ExportRow = Record<string, unknown>

const value = (row: ExportRow, key: string): string => {
  const raw = row[key]
  if (raw === null || raw === undefined || raw === '') return ''
  if (Array.isArray(raw)) return raw.join(', ')
  if (typeof raw === 'object') return JSON.stringify(raw)
  return String(raw)
}

const addRecord = (lines: string[], label: string, row: ExportRow, fields: Array<[string, string]>) => {
  const entries = fields
    .map(([title, key]) => [title, value(row, key)] as const)
    .filter(([, fieldValue]) => fieldValue)
  if (entries.length === 0) return
  lines.push(label)
  entries.forEach(([title, fieldValue]) => lines.push(`${title}: ${fieldValue}`))
  lines.push('')
}

const pdfEscape = (text: string): string => text
  .normalize('NFKD')
  .replace(/[^\x20-\x7E]/g, '?')
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)')

const wrap = (text: string, width = 94): string[] => {
  const words = text.split(/\s+/)
  const result: string[] = []
  let current = ''
  for (const word of words) {
    if (!word) continue
    if (word.length > width) {
      if (current) result.push(current)
      current = word
      continue
    }
    if (!current) current = word
    else if ((current.length + word.length + 1) <= width) current += ` ${word}`
    else {
      result.push(current)
      current = word
    }
  }
  if (current) result.push(current)
  return result
}

const createPdf = (lines: string[]): Uint8Array => {
  const wrapped = lines.flatMap(line => line ? wrap(line) : [''])
  const pages: string[][] = []
  for (let index = 0; index < wrapped.length; index += 48) pages.push(wrapped.slice(index, index + 48))
  if (pages.length === 0) pages.push(['No user-provided data was found.'])

  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + (index * 2)} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  pages.forEach(page => {
    const stream = [
      'BT',
      '/F1 10 Tf',
      '50 760 Td',
      ...page.flatMap((line, index) => [
        `(${pdfEscape(line)}) Tj`,
        ...(index < page.length - 1 ? ['0 -15 Td'] : []),
      ]),
      'ET',
    ].join('\n')
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + (pages.indexOf(page) * 2)} 0 R >>`)
    objects.push(`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`)
  })

  const header = '%PDF-1.4\n'
  let body = header
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(new TextEncoder().encode(body).length)
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = new TextEncoder().encode(body).length
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let index = 1; index < offsets.length; index++) body += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return new TextEncoder().encode(body)
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req)
  if (!isOriginAllowed(req)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const user = await requireUser(req)
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    const uid = user.id
    const results = await Promise.all([
      admin.from('profiles').select('full_name,email,phone,location,county,subcounty,skills,qualifications,experience,resume').eq('id', uid).maybeSingle(),
      admin.from('jobs').select('title,description,location,county,subcounty,budget_min,budget_max,deadline,category').eq('posted_by', uid),
      admin.from('bids').select('price,proposal').eq('bidder_id', uid),
      admin.from('messages').select('subject,message').eq('sender_id', uid),
      admin.from('direct_messages').select('content').eq('sender_id', uid),
      admin.from('profile_reviews').select('rating,comment').eq('reviewer_id', uid),
      admin.from('service_ratings').select('rating').eq('user_id', uid),
      admin.from('service_ads').select('business_name,description,category,location,county,subcounty,contact,destination_url,social_links').eq('owner_id', uid),
      admin.from('advertisements').select('title,description,destination_url,whatsapp_number,cta_text').eq('owner_id', uid),
    ])
    const failed = results.find(result => result.error)
    if (failed?.error) throw new Error(failed.error.message)

    const lines = [
      'ITUKARUA - MY DATA',
      'Information you provided to Itukarua',
      '',
    ]
    addRecord(lines, 'PROFILE', results[0].data as ExportRow ?? {}, [
      ['Full name', 'full_name'], ['Email', 'email'], ['Phone', 'phone'],
      ['Location', 'location'], ['County', 'county'], ['Subcounty', 'subcounty'],
      ['Skills', 'skills'], ['Qualifications', 'qualifications'], ['Experience', 'experience'],
      ['Resume', 'resume'],
    ])
    ;(results[1].data ?? []).forEach(row => addRecord(lines, 'JOB POSTED', row as ExportRow, [
      ['Title', 'title'], ['Description', 'description'], ['Location', 'location'],
      ['County', 'county'], ['Subcounty', 'subcounty'], ['Budget minimum', 'budget_min'],
      ['Budget maximum', 'budget_max'], ['Deadline', 'deadline'], ['Category', 'category'],
    ]))
    ;(results[2].data ?? []).forEach(row => addRecord(lines, 'BID', row as ExportRow, [
      ['Price', 'price'], ['Proposal', 'proposal'],
    ]))
    ;(results[3].data ?? []).forEach(row => addRecord(lines, 'MESSAGE', row as ExportRow, [
      ['Subject', 'subject'], ['Message', 'message'],
    ]))
    ;(results[4].data ?? []).forEach(row => addRecord(lines, 'DIRECT MESSAGE', row as ExportRow, [['Message', 'content']]))
    ;(results[5].data ?? []).forEach(row => addRecord(lines, 'PROFILE REVIEW', row as ExportRow, [
      ['Rating', 'rating'], ['Comment', 'comment'],
    ]))
    ;(results[6].data ?? []).forEach(row => addRecord(lines, 'SERVICE RATING', row as ExportRow, [['Rating', 'rating']]))
    ;(results[7].data ?? []).forEach(row => addRecord(lines, 'SERVICE AD', row as ExportRow, [
      ['Business name', 'business_name'], ['Description', 'description'], ['Category', 'category'],
      ['Location', 'location'], ['County', 'county'], ['Subcounty', 'subcounty'],
      ['Contact', 'contact'], ['Website', 'destination_url'], ['Social links', 'social_links'],
    ]))
    ;(results[8].data ?? []).forEach(row => addRecord(lines, 'ADVERTISEMENT', row as ExportRow, [
      ['Title', 'title'], ['Description', 'description'], ['Website', 'destination_url'],
      ['WhatsApp', 'whatsapp_number'], ['Call to action', 'cta_text'],
    ]))

    return new Response(createPdf(lines), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="itukarua-my-data.pdf"',
      },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
