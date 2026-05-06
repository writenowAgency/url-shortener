# Cloudflare hardening checklist

1. Enable `Always Use HTTPS` in Cloudflare SSL/TLS settings.
2. Set SSL mode to `Full (strict)`.
3. Add Cloudflare Access policy for `/` and `/api/shorten` (one-time PIN to your email).
4. Keep `/:slug` public so redirects work for everyone.
5. Add WAF rate-limit rule for `POST /api/shorten` (for example 10 req/min/IP).
6. Add cache rule:
   - Bypass cache for `/api/*`.
   - Bypass cache for `/*` where method is not GET.
   - Allow cache for `/static/*`.
7. Keep EC2 security group closed for inbound 80/443.
8. Verify with `nmap -Pn <ec2-public-ip>` that 80/443 are closed or filtered.
