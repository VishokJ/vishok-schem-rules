export const ADMIN_IPS = [
  '64.110.49.97',
]

export function normalizeIp(ip) {
  if (!ip) return ''
  if (ip.startsWith('::ffff:')) return ip.slice(7)
  return ip
}


