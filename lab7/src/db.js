import { readFile } from 'node:fs/promises';
import pg from 'pg';

export const pool = new pg.Pool({ connectionTimeoutMillis: 5000 });

export async function initDatabase() {
  const schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
}

export async function listContacts(q, limit, offset) {
  const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const { rows: [result] } = await pool.query(`
    WITH matching_contacts AS (
      SELECT id, name, phone, email
      FROM contacts
      WHERE name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1
    ), page_contacts AS (
      SELECT id, name, phone, email
      FROM matching_contacts
      ORDER BY id
      LIMIT $2 OFFSET $3
    )
    SELECT (SELECT COUNT(*) FROM matching_contacts) AS total,
           COALESCE(json_agg(page_contacts ORDER BY id), '[]'::json) AS contacts
    FROM page_contacts
  `, [pattern, limit, offset]);

  return { contacts: result.contacts, total: Number(result.total) };
}

export async function createContact({ name, phone, email }) {
  const { rows } = await pool.query(`
    INSERT INTO contacts (name, phone, email)
    VALUES ($1, $2, $3)
    RETURNING id, name, phone, email
  `, [name, phone, email]);

  return rows[0];
}

export async function updateContact(id, { name, phone, email }) {
  const { rows } = await pool.query(`
    UPDATE contacts
    SET name = $2, phone = $3, email = $4
    WHERE id = $1
    RETURNING id, name, phone, email
  `, [id, name, phone, email]);

  return rows[0];
}

export async function deleteContact(id) {
  const { rowCount } = await pool.query('DELETE FROM contacts WHERE id = $1', [id]);
  return rowCount > 0;
}
