import worker from './dist/server/index.js';

// Only the Sites dispatcher may assert a legacy ChatGPT identity. A standalone
// Worker is public, so it must never pass client-supplied identity headers on.
export default {
  ...worker,
  fetch(request, env, ctx) {
    const headers = new Headers(request.headers);
    for (const name of [...headers.keys()]) {
      if (name.toLowerCase().startsWith('oai-authenticated-user-')) headers.delete(name);
    }
    return worker.fetch(new Request(request, {headers}), env, ctx);
  },
};
