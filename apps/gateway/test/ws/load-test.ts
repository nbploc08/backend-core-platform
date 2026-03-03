/**
 * WebSocket Load Test — Day 41-42
 *
 * Simulate N concurrent WS clients connecting to the gateway,
 * run ping/pong latency, notification handlers, rate limit stress,
 * and multi-tab scenarios.
 *
 * Usage:
 *   npx tsx test/ws/load-test.ts
 *
 * Environment variables (all optional):
 *   WS_URL             — WebSocket target (default: http://localhost:3000)
 *   JWT_SECRET          — Must match gateway's JWT_SECRET (default: change-me)
 *   JWT_ISSUER          — (default: auth-service)
 *   JWT_AUDIENCE        — (default: api)
 *   NUM_CLIENTS         — Number of concurrent clients (default: 50)
 *   RAMP_UP_DELAY_MS    — Delay between each client connect (default: 50)
 */

import { io, Socket } from 'socket.io-client';
import { randomUUID } from 'crypto';
import { getConfig, generateToken, MetricsTracker, sleep } from './helpers.js';

const config = getConfig();
const metrics = new MetricsTracker();
const clients: Socket[] = [];

// ─── Client Factory ─────────────────────────────────────

function createClient(userId: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const token = generateToken(userId, config);

    const client = io(config.wsUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      timeout: 10_000,
    });

    const timeout = setTimeout(() => {
      metrics.recordConnectionFailure();
      client.disconnect();
      reject(new Error(`Timeout connecting user ${userId.slice(0, 8)}`));
    }, 10_000);

    client.on('authenticated', () => {
      clearTimeout(timeout);
      metrics.recordConnectionSuccess(Date.now() - start);
      resolve(client);
    });

    client.on('error', (data: any) => {
      if (typeof data === 'object' && data?.message?.includes?.('Rate limit')) {
        metrics.recordRateLimitHit();
      } else {
        metrics.recordError();
      }
    });

    client.on('connect_error', (err) => {
      clearTimeout(timeout);
      metrics.recordConnectionFailure();
      reject(err);
    });

    client.on('pong', () => metrics.recordMessageReceived());
    client.on('notification:new', () => metrics.recordMessageReceived());
    client.on('notification:updated', () => metrics.recordMessageReceived());
  });
}

// ─── Phase 1: Connect ───────────────────────────────────

async function phaseConnect() {
  console.log(
    `\n[Phase 1] Connecting ${config.numClients} clients (ramp-up ${config.rampUpDelayMs}ms/client)...`,
  );

  for (let i = 0; i < config.numClients; i++) {
    try {
      const client = await createClient(randomUUID());
      clients.push(client);
    } catch (err: any) {
      console.error(`  x Client ${i} failed: ${err.message}`);
    }
    if (config.rampUpDelayMs > 0 && i < config.numClients - 1) {
      await sleep(config.rampUpDelayMs);
    }
  }

  console.log(`  -> Connected: ${clients.length} / ${config.numClients}`);
}

// ─── Phase 2: Ping / Pong Latency ──────────────────────

async function phasePing() {
  const rounds = 3;
  console.log(`\n[Phase 2] Ping/Pong latency (${rounds} rounds x ${clients.length} clients)...`);

  for (let r = 0; r < rounds; r++) {
    const promises = clients.map(
      (client) =>
        new Promise<void>((resolve) => {
          const start = Date.now();
          metrics.recordMessageSent();

          const onPong = () => {
            metrics.recordPingLatency(Date.now() - start);
            resolve();
          };
          client.once('pong', onPong);
          client.emit('ping');

          setTimeout(() => {
            client.off('pong', onPong);
            resolve();
          }, 5_000);
        }),
    );

    await Promise.allSettled(promises);
    console.log(`  -> Round ${r + 1}/${rounds} done`);
    await sleep(500);
  }
}

// ─── Phase 3: Notification Read (functional) ────────────

async function phaseNotificationRead() {
  const subset = clients.slice(0, Math.min(10, clients.length));
  console.log(`\n[Phase 3] Notification:read functional test (${subset.length} clients)...`);

  for (const client of subset) {
    metrics.recordMessageSent();
    client.emit('notification:read', { notificationId: randomUUID() });
  }

  await sleep(2_000);
  console.log(`  -> Sent ${subset.length} notification:read messages`);
}

// ─── Phase 4: Rate Limit Stress ─────────────────────────

async function phaseRateLimit() {
  console.log('\n[Phase 4] Rate limit stress test...');

  const testClient = clients[0];
  if (!testClient) {
    console.log('  x No clients available, skipping');
    return;
  }

  const burstSize = 25;
  const before = metrics.snapshotRateLimitHits();

  for (let i = 0; i < burstSize; i++) {
    metrics.recordMessageSent();
    testClient.emit('notification:read', { notificationId: randomUUID() });
  }

  await sleep(3_000);
  const triggered = metrics.snapshotRateLimitHits() - before;

  console.log(`  -> Burst ${burstSize} msgs => ${triggered} rate-limited`);
  if (triggered > 0) {
    console.log('  -> Rate limiting is working correctly');
  } else {
    console.log('  -> WARNING: No rate limit triggered — verify MAX_MESSAGES_PER_SECOND');
  }
}

// ─── Phase 5: Multi-Tab Simulation ─────────────────────

async function phaseMultiTab() {
  const usersCount = 5;
  const tabsPerUser = 3;
  console.log(`\n[Phase 5] Multi-tab simulation (${usersCount} users x ${tabsPerUser} tabs)...`);

  const multiClients: Socket[] = [];

  for (let u = 0; u < usersCount; u++) {
    const userId = randomUUID();
    for (let t = 0; t < tabsPerUser; t++) {
      try {
        const client = await createClient(userId);
        multiClients.push(client);
      } catch (err: any) {
        console.error(`  x User ${u} tab ${t} failed: ${err.message}`);
      }
    }
  }

  console.log(`  -> Created ${multiClients.length} multi-tab connections`);
  await sleep(1_000);

  for (const c of multiClients) c.disconnect();
  console.log('  -> Multi-tab clients disconnected');
}

// ─── Phase 6: Disconnect All ────────────────────────────

async function phaseDisconnect() {
  console.log(`\n[Phase 6] Disconnecting ${clients.length} clients...`);
  for (const client of clients) client.disconnect();
  await sleep(1_000);
  console.log('  -> All clients disconnected');
}

// ─── Main ───────────────────────────────────────────────

async function main() {
  console.log('=========================================================');
  console.log('  WebSocket Load Test');
  console.log('=========================================================');
  console.log(`  Target       : ${config.wsUrl}`);
  console.log(`  Clients      : ${config.numClients}`);
  console.log(`  Ramp-up      : ${config.rampUpDelayMs}ms / client`);
  console.log('=========================================================');

  try {
    await phaseConnect();
    await phasePing();
    await phaseNotificationRead();
    await phaseRateLimit();
    await phaseMultiTab();
    await phaseDisconnect();
  } catch (err) {
    console.error('\nFatal error:', err);
  }

  console.log(metrics.getReport());
  process.exit(0);
}

main();
