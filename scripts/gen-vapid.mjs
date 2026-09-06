import { createRequire } from 'node:module';

const requireFromBackend = createRequire(
  new URL('../backend/package.json', import.meta.url)
);

const webpush = requireFromBackend('web-push');
const keys = webpush.generateVAPIDKeys();

console.log(`VAPID_PUBLIC_KEY: '${keys.publicKey}',`);
console.log(`VAPID_PRIVATE_KEY: '${keys.privateKey}',`);
