# Run EchoVote after a laptop restart (Windows + VS Code)

These steps start the Dockerized application from the VS Code terminal. Run
commands from the repository root (the folder containing `docker-compose.yml`).

## 1. Start Docker Desktop

Open Docker Desktop and wait until its engine is running.

## 2. Open the repository in VS Code

Open the EchoVote repository folder. In VS Code, choose **Terminal → New
Terminal**. The terminal should start in the repository root. If it does not,
change to that folder, for example:

```powershell
cd C:\Users\PC\Desktop\ecg-app
```

## 3. Start the existing containers

```powershell
docker compose up -d
```

After a laptop restart, this starts the existing images without rebuilding them.
It does not remove or reset the account database.

## 4. Wait for the backend and models

Check container state:

```powershell
docker compose ps
```

The backend loads the ECG models during startup and may take several minutes to
become healthy. Check its logs if it is still starting:

```powershell
docker compose logs --tail 100 backend
```

Check model readiness from PowerShell:

```powershell
curl.exe http://localhost:3001/api/health
```

When ready with trained model files installed, the response reports
`"models_loaded":8` and `"live":true`.

## 5. Open EchoVote

Visit **http://localhost:3001** in your browser.

## Stop the app safely

To stop containers while retaining registered accounts:

```powershell
docker compose stop
```

For normal shutdown or restarts, avoid `docker compose down -v`: the `-v` option
deletes the named `user_data` volume and its SQLite account database.

## When should I rebuild?

You do not need to rebuild after a laptop restart. Use this only after changing
application code or Docker configuration:

```powershell
docker compose up -d --build
```

The SQLite database remains in the named `user_data` volume when the services
are rebuilt. The volume is local to this Docker installation; back it up
separately if you need protection from disk loss or Docker data deletion.

## Authentication and account database

- Signup, login, and password changes are served by the backend under `/auth/*`.
- The frontend Nginx container forwards `/auth/*` and `/api/*` to FastAPI.
- SQLite is stored at `/app/data/users.db` in the backend container.
- Compose mounts the persistent `user_data` volume at `/app/data`.
- Passwords are stored as salted PBKDF2-HMAC-SHA256 hashes (260,000 iterations).
- A password change requires the current password. This app does not currently
  provide recovery for a forgotten password.
- Login state is currently maintained by the frontend; there are no server
  sessions or protected API routes.

## Troubleshooting

If the frontend opens but reports that the backend is offline:

```powershell
docker compose ps
docker compose logs --tail 100 backend
curl.exe http://localhost:3001/api/health
```

If a port is unavailable, check the published ports in `docker-compose.yml`
before changing them. The current defaults are frontend `3001` and backend
`8001`.
