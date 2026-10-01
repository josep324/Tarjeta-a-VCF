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

## Clau de Gemini compartida
1. A GitHub: Settings → Secrets and variables → Actions → *New repository secret* → `GEMINI_API_KEY`.
2. El workflow l'escriu a `config.js` en desplegar, així no queda al repositori ni a l'historial de git.
3. **Important**: el `config.js` publicat és públic. A Google Cloud Console → Credencials, restringeix la clau
   per *referrer HTTP* a `https://<usuari>.github.io/*` i limita-la a l'API *Generative Language*.
