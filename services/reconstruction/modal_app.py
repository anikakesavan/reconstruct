"""Run the reconstruction service on Modal (serverless, billed per second, sleeps when idle).

Deployed by .github/workflows/deploy-modal.yml. NOT yet run: written from Modal's documented API, untested.
One container only, because job state lives on that container's disk and in its worker thread.
"""
import modal

DA3_COMMIT = "3d835ec1a5802d64a8b8b15f817a1ab54809bfe4"
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "libgl1", "libglib2.0-0")
    .pip_install("torch", "torchvision", index_url="https://download.pytorch.org/whl/cpu")
    .pip_install_from_requirements("requirements.txt")
    .run_commands(
        "git clone https://github.com/ByteDance-Seed/Depth-Anything-3.git /opt/da3",
        f"git -C /opt/da3 checkout {DA3_COMMIT}",
    )
    .env({"RECONSTRUCT_DA3_SRC": "/opt/da3/src", "HF_HOME": "/cache/hf", "RECONSTRUCT_DATA_DIR": "/tmp/reconstruct",
          "RECONSTRUCT_MAX_VIEWS": "12", "RECONSTRUCT_ALLOWED_ORIGINS": "https://anikakesavan.github.io,http://localhost:3000"})
    .add_local_dir("app", remote_path="/root/app")
)
app = modal.App("reconstruct", image=image)
weights = modal.Volume.from_name("reconstruct-weights", create_if_missing=True)  # model downloads survive restarts


@app.function(cpu=2.0, memory=8192, timeout=1800, scaledown_window=600, max_containers=1, volumes={"/cache": weights})
@modal.concurrent(max_inputs=50)
@modal.asgi_app(label="reconstruct-api")
def api():
    from app.main import app as fastapi_app
    return fastapi_app
