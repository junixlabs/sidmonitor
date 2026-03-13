<?php

namespace JunixLabs\Observatory\Facades;

use Illuminate\Support\Facades\Facade;

/**
 * @method static \JunixLabs\Observatory\Collectors\InboundCollector inbound()
 * @method static \JunixLabs\Observatory\Collectors\OutboundCollector outbound()
 * @method static \JunixLabs\Observatory\Collectors\JobCollector jobs()
 * @method static \JunixLabs\Observatory\Contracts\ExporterInterface exporter()
 * @method static void increment(string $name, array $labels = [], float $value = 1)
 * @method static void gauge(string $name, float $value, array $labels = [])
 * @method static void histogram(string $name, float $value, array $labels = [])
 * @method static bool enabled()
 *
 * @see \JunixLabs\Observatory\Observatory
 */
class Observatory extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return 'observatory';
    }
}
