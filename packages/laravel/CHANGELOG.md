# Changelog

All notable changes to `laravel-observatory` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2024-12-25

### Added
- Initial release
- Inbound HTTP request monitoring with automatic middleware
- Outbound HTTP monitoring via Laravel HTTP client integration
- Queue job monitoring with JobProcessing/JobProcessed/JobFailed events
- Exception tracking and counting
- Prometheus metrics export with `/metrics` endpoint
- Support for multiple storage adapters (memory, redis, apc, apcu)
- Custom metrics API (counters, gauges, histograms)
- Configurable path/job/host exclusions
- Basic authentication for metrics endpoint
- SidMonitor exporter stub (coming soon)
- Comprehensive configuration options
- Laravel 10.x and 11.x support
- PHP 8.1+ support

### Prometheus Metrics
- `http_requests_total` - Total HTTP requests counter
- `http_request_duration_seconds` - Request latency histogram
- `http_outbound_requests_total` - Outbound HTTP requests counter
- `http_outbound_duration_seconds` - Outbound latency histogram
- `jobs_processed_total` - Queue jobs counter
- `jobs_duration_seconds` - Job duration histogram
- `exceptions_total` - Exceptions counter
