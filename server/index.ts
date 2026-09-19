import 'dotenv/config';
import { Store } from './db';
import { createApp } from './app';
import { seedDemo } from './seed';
const store = new Store();
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEMO === 'true') seedDemo(store);
const port = Number(process.env.PORT || 3001);
const server = createApp(store).listen(port, process.env.HOST || '127.0.0.1', () =>
  console.log(`Continuum API ready at http://${process.env.HOST || '127.0.0.1'}:${port}`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(() => {
      store.close();
      process.exit(0);
    }),
  );
