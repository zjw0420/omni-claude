# Stage 1: Build frontend
FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install
COPY frontend/ ./
RUN npx vite build

# Stage 2: Run backend + serve frontend
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/main.py .
COPY --from=frontend /frontend/dist ./static
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
