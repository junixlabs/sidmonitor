<?php

namespace JunixLabs\Observatory\Loggers;

use Illuminate\Console\Scheduling\Event as ScheduledEvent;
use Illuminate\Support\Facades\Log;
use JunixLabs\Observatory\Support\SensitiveDataMasker;

class ScheduledTaskLogger
{
    protected SensitiveDataMasker $masker;

    protected array $config;

    protected array $taskStartTimes = [];

    protected array $taskStartMemory = [];

    public function __construct(?SensitiveDataMasker $masker = null)
    {
        $this->masker = $masker ?? SensitiveDataMasker::fromConfig();
        $this->config = config('observatory.scheduled_tasks', []);
    }

    public function isEnabled(): bool
    {
        return config('observatory.enabled', true)
            && config('observatory.scheduled_tasks.enabled', true);
    }

    public function start(ScheduledEvent $event): void
    {
        if (! $this->isEnabled()) {
            return;
        }

        $key = $this->getTaskKey($event);
        $this->taskStartTimes[$key] = microtime(true);
        $this->taskStartMemory[$key] = memory_get_usage(true);
    }

    public function log(ScheduledEvent $event, string $status, float $duration, ?\Throwable $exception = null): void
    {
        if (! $this->isEnabled()) {
            return;
        }

        if (! $this->shouldLog($event, $duration)) {
            return;
        }

        $key = $this->getTaskKey($event);
        $startMemory = $this->taskStartMemory[$key] ?? memory_get_usage(true);
        $memoryUsed = memory_get_usage(true) - $startMemory;
        $peakMemory = memory_get_peak_usage(true);

        unset($this->taskStartTimes[$key], $this->taskStartMemory[$key]);

        $logData = $this->buildLogData($event, $status, $duration, $memoryUsed, $peakMemory, $exception);
        $channel = config('observatory.log_channel', 'observatory');

        if ($status === 'failed' || $exception !== null) {
            Log::channel($channel)->error('SCHEDULED_TASK', $logData);
        } else {
            Log::channel($channel)->info('SCHEDULED_TASK', $logData);
        }
    }

    protected function shouldLog(ScheduledEvent $event, float $duration): bool
    {
        $excludeCommands = $this->config['exclude_commands'] ?? [];
        $command = $this->getCommand($event);

        foreach ($excludeCommands as $excludeCommand) {
            if ($command === $excludeCommand || fnmatch($excludeCommand, $command)) {
                return false;
            }
        }

        $slowThreshold = $this->config['slow_threshold_ms'] ?? 0;
        if ($slowThreshold > 0) {
            $durationMs = $duration * 1000;
            if ($durationMs < $slowThreshold) {
                return false;
            }
        }

        return true;
    }

    protected function buildLogData(
        ScheduledEvent $event,
        string $status,
        float $duration,
        int $memoryUsed,
        int $peakMemory,
        ?\Throwable $exception = null
    ): array {
        $data = [
            'command' => $this->getCommand($event),
            'description' => $event->description ?? null,
            'expression' => $event->expression,
            'status' => $status,
            'duration_ms' => round($duration * 1000, 2),
            'timestamp' => now()->toIso8601String(),
            'memory' => [
                'used_mb' => round($memoryUsed / 1024 / 1024, 2),
                'peak_mb' => round($peakMemory / 1024 / 1024, 2),
            ],
        ];

        if ($exception !== null) {
            $data['exception'] = [
                'class' => get_class($exception),
                'message' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
            ];
        }

        if (property_exists($event, 'exitCode')) {
            $data['exit_code'] = $event->exitCode;
        }

        $data['environment'] = config('observatory.labels.environment', config('app.env'));

        return $data;
    }

    protected function getTaskKey(ScheduledEvent $event): string
    {
        return md5($event->expression . $this->getCommand($event));
    }

    protected function getCommand(ScheduledEvent $event): string
    {
        if (property_exists($event, 'command') && $event->command) {
            $command = $event->command;
            if (str_contains($command, "'artisan'")) {
                $command = preg_replace("/^.*?'artisan'\s*/", '', $command);
            }

            return trim($command, "' ");
        }

        return $event->description ?? 'Closure';
    }
}
