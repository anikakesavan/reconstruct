# Hosting the reconstruction service

So that "Scan your room" works on the live site with nothing running on your own computer.

Status: the `Dockerfile` here has **not been built or deployed yet**. Its Python requirements were installed into a clean environment and the service imported correctly. The steps below are the intended path.

## Modal (chosen: free monthly credits, sign-up reported as needing no card)

`modal_app.py` and `.github/workflows/deploy-modal.yml` deploy the service to Modal. **Untested: never deployed.**

1. Sign up at modal.com with GitHub.
2. In Modal: Settings, API Tokens, create a token. It gives a token ID and a token secret.
3. In this GitHub repository: Settings, Secrets and variables, Actions, **Secrets**: add `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET`.
4. Run the "Deploy scan service to Modal" workflow (Actions tab). Its log prints the service URL (`https://<workspace>--reconstruct-api.modal.run`).
5. Under **Variables**, add `RECONSTRUCT_API` with that URL, then re-run "Deploy site to GitHub Pages".

Cost: Modal bills per second for 2 CPU cores and 8 GB while a scan runs or the container is awake (it sleeps 10 minutes after
the last request). At Modal's listed rates that is roughly half a cent per scan. Sources disagree on whether the free credit
is $30 or $5 a month without a card; either covers hundreds of scans. If credits run out, scanning stops unless a card is added.

## Hugging Face Space

**Checked 12 Nov 2026: Docker Spaces now require a paid Hugging Face plan (PRO). Only Static Spaces are free, and a Static Space cannot run this service.** The steps below apply if you subscribe, or to any other host that runs a container with about 4 GB of memory.

1. With a PRO account at huggingface.co, create a new Space: SDK "Docker", hardware "CPU basic".
2. Put the contents of `services/reconstruction/` (Dockerfile, requirements.txt, app/) in the Space's repository.
3. In the Space settings add a variable `RECONSTRUCT_ALLOWED_ORIGINS` = `https://anikakesavan.github.io`.
4. When it is running, copy its URL (it looks like `https://<name>-<space>.hf.space`).
5. In the GitHub repository: Settings, Secrets and variables, Actions, Variables: add `RECONSTRUCT_API` with that URL, then re-run the Pages workflow.

## What to expect
- The first scan after the Space wakes downloads about 2 GB of model weights, so it can take several minutes. Later scans took 1.5 to 2 minutes for 8 photos on a 2-core CPU in development.
- Spaces on basic hardware sleep when idle and have no persistent disk: finished scans are lost on restart (designs saved in the browser are not).
- Uploads leave the visitor's computer. The service deletes originals after processing, but say so on the site before making it public.
- One scan runs at a time; others queue.
- Three models are held in memory (about 4 GB). A Space's 16 GB is enough; smaller hosts are not.
