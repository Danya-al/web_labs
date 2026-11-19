import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { alphabet, phoneSearch } from '../public/contact.js';

export const pool = new pg.Pool({ connectionTimeoutMillis: 5000 });

export async function initDatabase() {
  const schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
}

export async function listContacts({ q, letter, limit, offset }) {
  const pattern = q ? `%${q.toLowerCase().replace(/[\\%_]/g, '\\$&')}%` : null;
  const digits = phoneSearch(q);
  const { rows: [result] } = await pool.query(`
    WITH matching_contacts AS (
      SELECT id, full_name, phone, email, notes,
             translate(left(full_name, 1), $4, $3) AS initial
      FROM contacts
      WHERE $1::text IS NULL
         OR translate(full_name, $3, $4) ILIKE $1
         OR email ILIKE $1
         OR phone ILIKE $1
         OR ($2::text IS NOT NULL AND regexp_replace(phone, '[^0-9]', '', 'g') LIKE $2)
    ), named_groups AS (
      SELECT id, full_name, phone, email, notes,
             CASE WHEN strpos($3, initial) > 0 THEN initial ELSE '#' END AS letter
      FROM matching_contacts
    ), filtered_contacts AS (
      SELECT id, full_name, phone, email, notes, strpos($3, letter) AS group_order
      FROM named_groups
      WHERE $5::text IS NULL OR letter = $5
    ), page_contacts AS (
      SELECT id, full_name, phone, email, notes, group_order
      FROM filtered_contacts
      ORDER BY group_order, translate(full_name, $3, $4), id
      LIMIT $6 OFFSET $7
    )
    SELECT (SELECT COUNT(*) FROM filtered_contacts) AS total,
           ARRAY(SELECT DISTINCT letter FROM named_groups) AS letters,
           COALESCE(
             jsonb_agg(to_jsonb(page_contacts) - 'group_order'
                       ORDER BY group_order, translate(full_name, $3, $4), id),
             '[]'::jsonb
           ) AS contacts
    FROM page_contacts
  `, [pattern, digits ? `%${digits}%` : null, alphabet, alphabet.toLowerCase(), letter, limit, offset]);

  return { contacts: result.contacts, total: Number(result.total), letters: result.letters };
}

export async function getContact(id) {
  const { rows } = await pool.query(
    'SELECT id, full_name, phone, email, notes FROM contacts WHERE id = $1',
    [id],
  );
  return rows[0];
}

export async function createContact({ full_name, phone, email, notes }) {
  const { rows } = await pool.query(`
    INSERT INTO contacts (full_name, phone, email, notes)
    VALUES ($1, $2, $3, $4)
    RETURNING id, full_name, phone, email, notes
  `, [full_name, phone, email, notes]);
  return rows[0];
}

export async function updateContact(id, { full_name, phone, email, notes }) {
  const { rows } = await pool.query(`
    UPDATE contacts
    SET full_name = $2, phone = $3, email = $4, notes = $5
    WHERE id = $1
    RETURNING id, full_name, phone, email, notes
  `, [id, full_name, phone, email, notes]);
  return rows[0];
}

export async function deleteContact(id) {
  const { rowCount } = await pool.query('DELETE FROM contacts WHERE id = $1', [id]);
  return rowCount > 0;
}
