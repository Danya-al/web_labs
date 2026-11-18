
import { app } from './app.js';

const PORT = Number(process.env.PORT) || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  console.error(`Не удалось запустить сервер: ${err.message}`);
  process.exit(1);
});
