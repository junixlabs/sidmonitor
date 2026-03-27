FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir --upgrade pip
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd --create-home appuser
RUN mkdir -p /app/data && chown appuser:appuser /app/data
USER appuser

EXPOSE 8000

CMD ["python", "run.py"]
