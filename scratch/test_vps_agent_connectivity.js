/**
 * CloudPrint Pro - VPS & Edge Print Agent Connectivity Diagnostics
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', 'agent', '.env') });

const targets = [
  { name: 'Local Kiosk Server Gateway', url: process.env.SERVER_URL || 'http://localhost:3000' },
  { name: 'Production VPS Remote Domain', url: 'https://printpro.hudumacyber.shop' },
  { name: 'Alternative Production URL', url: 'https://printpro.ke' }
];

const agentId = process.env.AGENT_ID || 'AGT-LAN-01';
const agentToken = process.env.AGENT_TOKEN || 'cloudprint_agent_secret_key_01';

console.log('================================================================');
console.log('📡 CLOUDPRINT PRO - VPS <-> PRINT AGENT CONNECTIVITY TEST');
console.log('================================================================');
console.log(`🔑 Agent ID    : ${agentId}`);
console.log(`🛡️ Agent Token : ${agentToken.slice(0, 10)}...${agentToken.slice(-4)}`);
console.log('================================================================\n');

function runProbe(targetUrl, endpoint, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    try {
      const fullUrl = new URL(endpoint, targetUrl);
      const client = fullUrl.protocol === 'https:' ? https : http;

      const reqHeaders = {
        'User-Agent': 'CloudPrint-Agent-Probe/2.0',
        ...headers
      };

      if (body) {
        reqHeaders['Content-Type'] = 'application/json';
      }

      const req = client.request(fullUrl, { method, headers: reqHeaders, timeout: 5000 }, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          const latency = Date.now() - startTime;
          let parsed = null;
          try { parsed = JSON.parse(raw); } catch (e) { parsed = raw; }
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 400,
            status: res.statusCode,
            latency,
            data: parsed,
            error: null
          });
        });
      });

      req.on('error', (err) => {
        resolve({
          ok: false,
          status: null,
          latency: Date.now() - startTime,
          data: null,
          error: err.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          ok: false,
          status: null,
          latency: Date.now() - startTime,
          data: null,
          error: 'Connection Timed Out (5000ms)'
        });
      });

      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      req.end();
    } catch (e) {
      resolve({
        ok: false,
        status: null,
        latency: Date.now() - startTime,
        data: null,
        error: e.message
      });
    }
  });
}

async function testTarget(target) {
  console.log(`🌐 Testing Target: [${target.name}] -> ${target.url}`);

  // 1. Health Probe
  const healthRes = await runProbe(target.url, '/healthz');
  if (!healthRes.ok) {
    console.log(`  ❌ [UNREACHABLE] ${healthRes.error || `HTTP ${healthRes.status}`}`);
    console.log(`     (Latency: ${healthRes.latency}ms)\n`);
    return { target: target.name, reachable: false, error: healthRes.error || `HTTP ${healthRes.status}` };
  }
  console.log(`  ✔ Health Check Passed: HTTP ${healthRes.status} (${healthRes.latency}ms)`);

  // 2. Heartbeat Ping
  let authHeaders = {
    'x-agent-id': agentId,
    'x-agent-token': agentToken
  };

  let heartbeatRes = await runProbe(
    target.url,
    '/api/print/heartbeat',
    'POST',
    authHeaders,
    { hostname: 'TestProbeHost', platform: 'win32', timestamp: new Date().toISOString() }
  );

  if (!heartbeatRes.ok && heartbeatRes.status === 403) {
    // Try fallback token
    console.log(`  ℹ️ Token ${agentToken.slice(0, 10)}... rejected (403). Testing fallback default token 'cloudprint_agent_secret_key_01'...`);
    authHeaders['x-agent-token'] = 'cloudprint_agent_secret_key_01';
    heartbeatRes = await runProbe(
      target.url,
      '/api/print/heartbeat',
      'POST',
      authHeaders,
      { hostname: 'TestProbeHost', platform: 'win32', timestamp: new Date().toISOString() }
    );
  }

  if (!heartbeatRes.ok) {
    console.log(`  ❌ [AUTH/HEARTBEAT FAILED] HTTP ${heartbeatRes.status}: ${JSON.stringify(heartbeatRes.data)}`);
    return { target: target.name, reachable: true, auth: false };
  }
  console.log(`  ✔ Agent Heartbeat Authenticated: Status '${heartbeatRes.data?.status || 'OK'}' (${heartbeatRes.latency}ms)`);

  // 3. Queue Polling Probe
  const queueRes = await runProbe(target.url, '/api/print/poll-queue', 'GET', authHeaders);
  if (!queueRes.ok) {
    console.log(`  ❌ [QUEUE POLL FAILED] HTTP ${queueRes.status}: ${JSON.stringify(queueRes.data)}`);
    return { target: target.name, reachable: true, auth: true, poll: false };
  }
  console.log(`  ✔ Queue Polling Functional: Received queue payload (${queueRes.latency}ms)`);
  console.log(`  🎉 Target [${target.name}] is 100% OPERATIONAL & READY FOR LIVE PRINTING.\n`);

  return { target: target.name, reachable: true, auth: true, poll: true, latency: queueRes.latency };
}

async function runAll() {
  const results = [];
  for (const t of targets) {
    results.push(await testTarget(t));
  }

  console.log('================================================================');
  console.log('📊 CONNECTIVITY SUMMARY REPORT:');
  console.log('================================================================');
  results.forEach(r => {
    if (r.reachable && r.auth && r.poll) {
      console.log(`✅ ${r.target.padEnd(32)} : CONNECTED & AUTHENTICATED (${r.latency}ms)`);
    } else if (r.reachable) {
      console.log(`⚠️ ${r.target.padEnd(32)} : REACHABLE BUT AUTH FAILED`);
    } else {
      console.log(`❌ ${r.target.padEnd(32)} : OFFLINE / UNREACHABLE (${r.error})`);
    }
  });
  console.log('================================================================\n');
}

runAll();
