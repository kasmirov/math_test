# syntax=docker/dockerfile:1

# Local / personal image: HTTP server for debugging.
# Minimal page set: application and help only

# Build stage
FROM python:3.12-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Runtime stage
FROM python:3.12-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Copy application files
COPY . .

# Minimal page set for local runs:
# без заглавной страницы, футера и документов/баннера по персональным данным
RUN rm -f server/templates/index.html server/templates/footer.html \
    server/templates/policy.html server/templates/consent.html server/js/consent.js

# Create directory for database persistence
RUN mkdir -p /app/data
VOLUME /app/data

# Set environment variables (can be overridden at runtime)
ENV DATABASE_PATH=/app/data/app.db \
    APP_PAGES_MODE=minimal

# Expose the Flask port
EXPOSE 5000

# Run the Flask web server
CMD ["python", "math_test.py", "--server"]
