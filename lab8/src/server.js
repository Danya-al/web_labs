import { once } from 'node:events';
import { app } from './app.js';
import { initDatabase, pool } from './db.js';

const port = Number(process.env.PORT ?? 3008);

pool.on('error', (err) => console.error('Ошибка соединения с PostgreSQL:', err.message));

try {
  await initDatabase();
  const server = app.listen(port, '127.0.0.1');
  await once(server, 'listening');
  console.log(`Адресная книга доступна по адресу http://127.0.0.1:${server.address().port}/`);
} catch (err) {
  console.error(`Не удалось запустить сервер: ${err.message}`);
  process.exitCode = 1;
  await pool.end();
}
