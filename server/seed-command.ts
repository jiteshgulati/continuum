import 'dotenv/config';
import { Store } from './db';
import { seedDemo } from './seed';
const store = new Store();
seedDemo(store);
store.close();
console.log('Example workspace ready. Sign in with alex@continuum.demo / Continuum2026!');
