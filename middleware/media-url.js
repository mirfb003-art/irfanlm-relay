const net = require('net');

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host === 'metadata.google.internal' || host === 'metadata') return true;
  if (net.isIP(host) === 4) {
    const parts = host.split('.').map(Number);
    return parts[0] === 10 || parts[0] === 127 || (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) ||
      parts[0] === 0;
  }
  if (net.isIP(host) === 6) return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:');
  return false;
}

function validateMediaUrl(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 8192) {
    throw new Error('mediaUrl must be a valid HTTPS URL');
  }
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('mediaUrl must be a valid HTTPS URL'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || isPrivateHost(parsed.hostname)) {
    throw new Error('mediaUrl must be a public HTTPS URL');
  }
  return parsed.toString();
}

module.exports = { validateMediaUrl };

// This is intentionally a lightweight guard. Railway should still be deployed
// behind the shared X-Relay-Token and should never be exposed without auth.
