<?php

namespace JunixLabs\Observatory\Collectors;

use Illuminate\Console\Scheduling\Event as ScheduledEvent;
use Illuminate\Support\Str;
use JunixLabs\Observatory\Contracts\ExporterInterface;
use JunixLabs\Observatory\Loggers\ScheduledTaskLogger;

class ScheduledTaskCollector
{
    protected ExporterInterface $exporter;

    protected ScheduledTaskLogger $logger;

    protected array $taskTimings = [];

    public function __construct(ExporterInterface $exporter, ScheduledTaskLogger $logger)
    {
        $this->exporter = $exporter;
        $this->logger = $logger;
    }

    public function start(ScheduledEvent $event): void
    {
        if (! $this->shouldMonitor($event)) {
            return;
        }

        $key = $this->getTaskKey($event);
        $this->taskTimings[$key] = [
            'start_time' => microtime(true),
            'start_memory' => memory_get_usage(true),
            'scheduled_at' => now()->toIso8601String(),
        ];

        $this->logger->start($event);
    }

    public function end(ScheduledEvent $event, string $status, ?\Throwable $exception = null): void
    {
        $key = $this->getTaskKey($event);
        $timing = $this->taskTimings[$key] ?? null;

        $startTime = $timing['start_time'] ?? microtime(true);
        $duration = microtime(true) - $startTime;

        unset($this->taskTimings[$key]);

        $data = [
            'task_id' => Str::uuid()->toString(),
            'command' => $this->getCommand($event),
            'description' => $event->description ?? null,
            'expression' => $event->expression,
            'timezone' => $event->timezone ?? config('app.timezone', 'UTC'),
            'status' => $status,
            'scheduled_at' => $timing['scheduled_at'] ?? now()->toIso8601String(),
            'started_at' => $timing ? date('c', (int) $timing['start_time']) : now()->toIso8601String(),
            'completed_at' => now()->toIso8601String(),
            'duration_ms' => (int) round($duration * 1000),
            'memory_usage_mb' => round(memory_get_usage(true) / 1048576, 2),
            'without_overlapping' => $event->withoutOverlapping ?? false,
            'mutex_name' => $event->mutexName() ?? null,
            'metadata' => new \stdClass(),
        ];

        if ($exception !== null) {
            $data['error_message'] = $exception->getMessage();
            $data['error_trace'] = $exception->getFile() . ':' . $exception->getLine();
        }

        if (property_exists($event, 'exitCode')) {
            $data['exit_code'] = $event->exitCode;
        }

        // Capture output if configured
        if (config('observatory.scheduled_tasks.log_output', false) && property_exists($event, 'output')) {
            $maxSize = config('observatory.scheduled_tasks.max_output_size', 4096);
            if (is_string($event->output) && file_exists($event->output)) {
                $fh = fopen($event->output, 'r');
                if ($fh !== false) {
                    $data['output'] = fread($fh, $maxSize);
                    fclose($fh);
                }
            }
        }

        $data['labels'] = config('observatory.labels', []);

        $this->exporter->recordScheduledTask($data);

        $this->logger->log($event, $status, $duration, $exception);
    }

    public function skip(ScheduledEvent $event): void
    {
        $this->end($event, 'skipped');
    }

    public function shouldMonitor(ScheduledEvent $event): bool
    {
        $excludeCommands = config('observatory.scheduled_tasks.exclude_commands', []);
        $command = $this->getCommand($event);

        foreach ($excludeCommands as $excludeCommand) {
            if ($command === $excludeCommand || fnmatch($excludeCommand, $command)) {
                return false;
            }
        }

        return true;
    }

    protected function getTaskKey(ScheduledEvent $event): string
    {
        return md5($event->expression . $this->getCommand($event));
    }

    protected function getCommand(ScheduledEvent $event): string
    {
        if (property_exists($event, 'command') && $event->command) {
            // Strip the PHP binary and artisan path prefix
            $command = $event->command;
            if (str_contains($command, "'artisan'")) {
                $command = preg_replace("/^.*?'artisan'\s*/", '', $command);
            }

            return trim($command, "' ");
        }

        return $event->description ?? 'Closure';
    }
}
