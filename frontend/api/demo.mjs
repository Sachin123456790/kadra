import { demoResponse } from '../demo/handler.mjs';

export default function handler(req, res) {
  const url = new URL(req.url, 'https://demo.invalid');
  const path = url.searchParams.get('path') ?? url.pathname.replace(/^\/api\/v1\/?/, '');
  const response = demoResponse({ method: req.method, path, enabled: process.env.ANGAINOR_DEMO_MODE === 'true' });
  res.statusCode = response.status;
  for (const [name, value] of Object.entries(response.headers)) res.setHeader(name, value);
  if (response.status === 405) res.setHeader('Allow', 'GET, HEAD');
  res.end(req.method === 'HEAD' ? undefined : response.body);
}
