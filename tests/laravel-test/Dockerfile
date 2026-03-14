FROM php:8.2-cli

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    libsqlite3-dev \
    zip \
    unzip \
    && docker-php-ext-install pdo pdo_sqlite mbstring xml pcntl bcmath \
    && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Copy the observatory package first (needed for composer install)
COPY packages/laravel /packages/laravel

# Copy Laravel test app
COPY tests/laravel-test /app

# Fix composer repository path for Docker context
RUN sed -i 's|../../packages/laravel|/packages/laravel|' /app/composer.json

# Install dependencies (update to resolve lock file mismatch)
RUN composer update --no-interaction --no-progress --prefer-dist

# Create SQLite database
RUN touch /app/database/database.sqlite

# Copy .env if not exists
RUN cp -n /app/.env.example /app/.env 2>/dev/null || true

# Generate app key & run migrations
RUN php artisan key:generate --force \
    && php artisan migrate --force 2>/dev/null || true

EXPOSE 8080

CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8080"]
