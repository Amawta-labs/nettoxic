# Guion demo

1. Abrir Nettoxic en Android conectado por ADB.
2. Mostrar bandeja con tres mensajes.
3. Abrir "Analizar mensaje manual" y pegar un SMS sospechoso en vivo.
4. Mostrar que `/analyze` devuelve score, senales detectadas, motor usado y estado de fuentes externas.
5. Entrar al caso BancoEstado falso o al resultado manual.
6. Abrir "Que hacer ahora" y reportar caso confirmado.
7. Mostrar que el backend esta conectado; si no lo esta, la app debe mostrar error y no simular datos.

Comandos previos:

```bash
cd backend
npm run build
node dist/index.js
adb reverse tcp:8787 tcp:8787
```

Alcance honesto para pitch tecnico:

- Bandeja sintetica, no Gmail OAuth todavia.
- Texto, no screenshot/vision todavia.
- URLhaus solo se presenta como match si `URLHAUS_AUTH_KEY` esta configurado y la API devuelve match.
- PhishTank y CMF no se presentan como matches salvo integracion real.
