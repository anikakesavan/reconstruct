# Reconstruction service as a container, for hosts such as a Hugging Face Space (Docker SDK, CPU).
# NOT yet built or run anywhere: treat as a starting point. See HOSTING.md.
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends git libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu && pip install --no-cache-dir -r requirements.txt
RUN git clone https://github.com/ByteDance-Seed/Depth-Anything-3.git third_party/Depth-Anything-3 && git -C third_party/Depth-Anything-3 checkout 3d835ec1a5802d64a8b8b15f817a1ab54809bfe4
COPY app ./app
ENV HF_HOME=/tmp/hf RECONSTRUCT_DATA_DIR=/tmp/reconstruct RECONSTRUCT_MAX_VIEWS=12
EXPOSE 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
