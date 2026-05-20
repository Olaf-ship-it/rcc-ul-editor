# RCC Unit-Leiter Editor

## Start

```bash
npm install
npm start
```

Dann im Browser `http://localhost:3000` aufrufen.

## Environment (Neon / Postgres)

Empfohlen lokal:

```bash
cp .env.example .env
```

Dann `.env` befuellen:

```bash
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
JWT_SECRET=<langes-zufaelliges-secret>
```

Alternativ per `export` im Terminal:

```bash
export DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require"
export JWT_SECRET="bitte-eigenes-lang-zufaelliges-secret"
```

Auf Vercel dieselben Variablen in den Project Settings unter **Environment Variables** setzen.

## Troubleshooting

- Fehler `DATABASE_URL ist nicht gesetzt`: `.env` fehlt oder Variable nicht im selben Terminal gesetzt.
- Fehler `Invalid URL`: Connection String ist kaputt formatiert (z. B. fehlendes `postgresql://` oder nicht encodete Sonderzeichen im Passwort).
- Schnelltest:

```bash
node -e 'console.log(!!process.env.DATABASE_URL, !!process.env.JWT_SECRET)'
```

## Initiale Login-Daten

- E-Mail: `olaf.glebsattel@realcore.de`
- Passwort: `ChangeMe123!`
- Unit: beliebig aus der Dropdown-Liste

## Was wurde sicherheitsseitig verbessert

- Authentifizierung und Rollen laufen serverseitig.
- Passwörter werden gehasht in Neon/Postgres gespeichert.
- Session läuft über ein HTTP-only Cookie.
- Eintragszugriff ist serverseitig pro Rolle/Unit geschützt.
- Audit-Felder (`createdBy`, `updatedBy`, Zeitstempel) werden mitgeführt.
- Admin-UI zeigt keine Passwörter mehr.

