FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
ENV DATA_DIR=/data
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
