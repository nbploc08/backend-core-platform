import * as jwt from 'jsonwebtoken';

// ─── Config ─────────────────────────────────────────────

export interface LoadTestConfig {
  wsUrl: string;
  jwtSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
  numClients: number;
  rampUpDelayMs: number;
}

export function getConfig(): LoadTestConfig {
  return {
    wsUrl: process.env.WS_URL || 'http://localhost:3000',
    jwtSecret: process.env.JWT_SECRET || 'change-me',
    jwtIssuer: process.env.JWT_ISSUER || 'auth-service',
    jwtAudience: process.env.JWT_AUDIENCE || 'api',
    numClients: parseInt(process.env.NUM_CLIENTS || '50', 10),
    rampUpDelayMs: parseInt(process.env.RAMP_UP_DELAY_MS || '50', 10),
  };
}

// ─── JWT Helper ─────────────────────────────────────────

export function generateToken(userId: string, config: LoadTestConfig): string {
  return jwt.sign(
    { sub: userId, email: `loadtest-${userId.slice(0, 8)}@test.local`, permVersion: 1 },
    config.jwtSecret,
    { issuer: config.jwtIssuer, audience: config.jwtAudience, expiresIn: '1h' },
  );
}

// ─── Metrics Tracker ────────────────────────────────────

export class MetricsTracker {
  private connectionSuccesses = 0;
  private connectionFailures = 0;
  private messagesSent = 0;
  private messagesReceived = 0;
  private errors = 0;
  private rateLimitHits = 0;
  private pingLatencies: number[] = [];
  private connectionTimes: number[] = [];
  private startTime = Date.now();

  recordConnectionSuccess(timeMs: number) {
    this.connectionSuccesses++;
    this.connectionTimes.push(timeMs);
  }

  recordConnectionFailure() {
    this.connectionFailures++;
  }

  recordMessageSent() {
    this.messagesSent++;
  }

  recordMessageReceived() {
    this.messagesReceived++;
  }

  recordError() {
    this.errors++;
  }

  recordRateLimitHit() {
    this.rateLimitHits++;
  }

  recordPingLatency(ms: number) {
    this.pingLatencies.push(ms);
  }

  snapshotRateLimitHits(): number {
    return this.rateLimitHits;
  }

  getReport(): string {
    const elapsed = Date.now() - this.startTime;
    const fmt = (arr: number[]) => {
      if (arr.length === 0) return { avg: 'N/A', p95: 'N/A', p99: 'N/A', min: 'N/A', max: 'N/A' };
      const sorted = [...arr].sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);
      return {
        avg: (sum / sorted.length).toFixed(2),
        p95: sorted[Math.ceil(0.95 * sorted.length) - 1]?.toFixed(2) ?? 'N/A',
        p99: sorted[Math.ceil(0.99 * sorted.length) - 1]?.toFixed(2) ?? 'N/A',
        min: sorted[0].toFixed(2),
        max: sorted[sorted.length - 1].toFixed(2),
      };
    };

    const ping = fmt(this.pingLatencies);
    const conn = fmt(this.connectionTimes);
    const totalClients = this.connectionSuccesses + this.connectionFailures;
    const hasIssues = this.connectionFailures > 0 || this.errors > 0;

    const lines = [
      '',
      '╔═══════════════════════════════════════════════════════╗',
      '║            WS LOAD TEST REPORT                       ║',
      '╠═══════════════════════════════════════════════════════╣',
      `║  Duration             : ${(elapsed / 1000).toFixed(1).padEnd(30)}║`,
      `║  Total Clients        : ${String(totalClients).padEnd(30)}║`,
      '║                                                       ║',
      '║  ── Connections ──────────────────────────────────── ║',
      `║  Success              : ${String(this.connectionSuccesses).padEnd(30)}║`,
      `║  Failed               : ${String(this.connectionFailures).padEnd(30)}║`,
      `║  Avg Connect Time     : ${(conn.avg + 'ms').padEnd(30)}║`,
      `║  Min / Max            : ${(conn.min + 'ms / ' + conn.max + 'ms').padEnd(30)}║`,
      '║                                                       ║',
      '║  ── Messages ────────────────────────────────────── ║',
      `║  Sent                 : ${String(this.messagesSent).padEnd(30)}║`,
      `║  Received             : ${String(this.messagesReceived).padEnd(30)}║`,
      `║  Errors               : ${String(this.errors).padEnd(30)}║`,
      `║  Rate Limit Hits      : ${String(this.rateLimitHits).padEnd(30)}║`,
      '║                                                       ║',
      '║  ── Ping Latency ────────────────────────────────── ║',
      `║  Samples              : ${String(this.pingLatencies.length).padEnd(30)}║`,
      `║  Avg                  : ${(ping.avg + 'ms').padEnd(30)}║`,
      `║  P95                  : ${(ping.p95 + 'ms').padEnd(30)}║`,
      `║  P99                  : ${(ping.p99 + 'ms').padEnd(30)}║`,
      `║  Min / Max            : ${(ping.min + 'ms / ' + ping.max + 'ms').padEnd(30)}║`,
      '║                                                       ║',
      '║  ── Result ──────────────────────────────────────── ║',
      `║  Status               : ${(hasIssues ? 'WARN — check failures above' : 'PASS').padEnd(30)}║`,
      '╚═══════════════════════════════════════════════════════╝',
      '',
    ];

    return lines.join('\n');
  }
}

// ─── Utilities ──────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
