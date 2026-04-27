#!/usr/bin/env node
// Quick DB verifier for OutreachDraft create/update behavior.
// Usage:
//   node --loader ts-node/esm scripts/verify_draft_upsert.ts                       # snapshot all drafts
//   node --loader ts-node/esm scripts/verify_draft_upsert.ts <project_uuid>        # filter to one project
//
// Prints rows ordered by updated_at DESC with create vs revise indicators
// (created_at !== updated_at => revised at least once).

import pg from 'pg'

const { Client } = pg

const projectUuidArg = process.argv[2]

const client = new Client({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_DATABASE ?? 'envoy_db_dev',
})

await client.connect()

const params: unknown[] = []
let where = ''
if (projectUuidArg) {
  params.push(projectUuidArg)
  where = `WHERE p.uuid = $1`
}

const sql = `
  SELECT
    od.uuid              AS draft_uuid,
    od.subject,
    LEFT(od.body, 80)    AS body_preview,
    od.status,
    pv.uuid              AS project_vendor_uuid,
    v.name               AS vendor_name,
    v.email              AS vendor_email,
    p.uuid               AS project_uuid,
    p.title              AS project_name,
    od.created_timestamp  AS created_at,
    od.modified_timestamp AS updated_at,
    (od.modified_timestamp > od.created_timestamp + interval '1 second') AS revised
  FROM envoy_schema.outreach_drafts od
  JOIN envoy_schema.project_vendors pv ON pv.uuid = od.project_vendor_uuid
  JOIN envoy_schema.vendors v          ON v.uuid = pv.vendor_uuid
  JOIN envoy_schema.projects p         ON p.uuid = pv.project_uuid
  ${where}
  ORDER BY od.modified_timestamp DESC
  LIMIT 50;
`

const { rows } = await client.query(sql, params)

if (rows.length === 0) {
  console.log('No outreach drafts found.')
} else {
  for (const r of rows) {
    console.log(
      `[${r.revised ? 'REVISED' : 'NEW    '}] ${r.draft_uuid}  ${r.vendor_name} <${r.vendor_email}>  status=${r.status}\n  subject: ${r.subject}\n  body:    ${r.body_preview.replace(/\n/g, ' ')}…\n  project: ${r.project_name} (${r.project_uuid})\n  created: ${r.created_at.toISOString()}  updated: ${r.updated_at.toISOString()}\n`
    )
  }
  const newCount = rows.filter((r) => !r.revised).length
  const revCount = rows.filter((r) => r.revised).length
  console.log(`Total: ${rows.length}  (new: ${newCount}, revised at least once: ${revCount})`)
}

await client.end()
