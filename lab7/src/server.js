import { once } from 'node:events';
import { app } from './app.js';
import { initDatabase, pool } from './db.js';

const port = Number(process.env.PORT ?? 3007);

pool.on('error', (err) => console.error('Ошибка соединения с PostgreSQL:', err.message));

try {
  await initDatabase();
  const server = app.listen(port, '127.0.0.1');
  await once(server, 'listening');
  console.log(`API контактов доступен по адресу http://127.0.0.1:${server.address().port}/api/contacts`);
} catch (err) {
  console.error(`Не удалось запустить сервер: ${err.message}`);
  process.exitCode = 1;
  await pool.end();
}
