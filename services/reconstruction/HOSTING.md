# Hosting the reconstruction service

So that "Scan your room" works on the live site with nothing running on your own computer.

Status: the `Dockerfile` here has **not been built or deployed yet**. The steps below are the intended path.

## Hugging Face Space (free CPU tier)
1. Create a free account at huggingface.co and a new Space: SDK "Docker", hardware "CPU basic".
2. Put the contents of `services/reconstruction/` (Dockerfile, requirements.txt, app/) in the Space's repository.
3. In the Space settings add a variable `RECONSTRUCT_ALLOWED_ORIGINS` = `https://anikakesavan.github.io`.
4. When it is running, copy its URL (it looks like `https://<name>-<space>.hf.space`).
5. In the GitHub repository: Settings, Secrets and variables, Actions, Variables: add `RECONSTRUCT_API` with that URL, then re-run the Pages workflow.

## What to expect
- The first scan after the Space wakes downloads about 2 GB of model weights, so it can take several minutes. Later scans took 1.5 to 2 minutes for 8 photos on a 2-core CPU in development.
- Free Spaces sleep when idle and have no persistent disk: finished scans are lost on restart (designs saved in the browser are not).
- Uploads leave the visitor's computer. The service deletes originals after processing, but say so on the site before making it public.
- One scan runs at a time; others queue.
- Three models are held in memory (about 4 GB). The free tier's 16 GB is enough; smaller hosts are not.
