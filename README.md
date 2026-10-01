# Targeta → VCF

Web app (PWA) per al mòbil: fa una foto d'una targeta de visita (o enganxes text), n'extreu les dades
(nom, cognoms, telèfons, emails, empresa, posició, webs, adreça…), les mostra per verificar-les/editar-les
i desa el contacte com a `.vcf` (vCard 3.0).

- OCR al dispositiu amb [Tesseract.js](https://github.com/naptha/tesseract.js) (spa+cat+eng); la foto no surt del mòbil.
- Només s'omplen les dades presents al text; la resta queda buida.
- Opció «Desa automàticament» per saltar-se la verificació.
- «Desa» obre el full de compartir del mòbil (Contactes) o descarrega el `.vcf`.
- Instal·lable (Afegeix a la pantalla d'inici) i funciona offline un cop carregats els idiomes OCR.

## Ús al mòbil
Cal servir-la per HTTPS. Amb GitHub Pages (Settings → Pages → Source: *GitHub Actions*) el workflow
`.github/workflows/pages.yml` la publica en fer push a `main`. Obre la URL al mòbil i tria
«Afegeix a la pantalla d'inici».

## Desenvolupament
`npx http-server .` i obre-la al navegador. El parser (`parser.js`) no té dependències.

## Codi d'accés (clau de Gemini protegida)
La clau **no** va mai al front: viu en un Cloudflare Worker (`worker/`) que exigeix un codi d'accés.
1. `cd worker && npx wrangler deploy` (canvia `ALLOWED_ORIGIN` a `wrangler.toml` per la teva URL de GitHub Pages).
2. `npx wrangler secret put GEMINI_API_KEY` i `npx wrangler secret put ACCESS_CODES` (un o més codis separats per comes).
3. A GitHub: Settings → Secrets and variables → Actions → *Variables* → `PROXY_URL` = URL del Worker.
4. Per revocar l'accés, canvia `ACCESS_CODES`. Opcional: afegeix una regla de *rate limiting* al Worker a Cloudflare.
Sense `PROXY_URL` l'app funciona amb la clau pròpia de cada usuari (camp «Motor d'anàlisi»).
