FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Create a directory for SQLite database persistence
RUN mkdir -p /data

# Use a non-root user for security
RUN useradd -m -u 1001 cadence && chown -R cadence:cadence /app /data
USER cadence

# Railway provides a dynamic PORT environment variable.
# We default to 8000 for local compatibility.
ENV PORT=8000

# Start the server using the dynamic port
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 2"]
