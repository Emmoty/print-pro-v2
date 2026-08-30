/**
 * Verification of Single-Instance Mutex for Print Agent
 */

const { spawn } = require('child_process');
const path = require('path');
const assert = require('assert');

console.log('🔒 STARTING SINGLE-INSTANCE PRINT AGENT MUTEX VERIFICATION...\n');

const agentScript = path.join(__dirname, '..', 'agent', 'index.js');

console.log('🧪 Test 1: Spawning Primary Agent Instance #1...');
const agent1 = spawn('node', [agentScript], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, SERVER_URL: 'http://localhost:3000' }
});

let agent1Started = false;

agent1.stdout.on('data', (data) => {
  const str = data.toString();
  console.log('[Agent1]:', str.trim());
  if (str.includes('Print Agent daemon started')) {
    agent1Started = true;
  }
});

agent1.stderr.on('data', (data) => {
  console.error('[Agent1 Err]:', data.toString());
});

setTimeout(() => {
  assert.ok(agent1Started, 'Agent 1 must start and acquire lock successfully');
  console.log('  ✔ Agent Instance #1 started and acquired Single-Instance lock.\n');

  console.log('🧪 Test 2: Spawning Duplicate Agent Instance #2 (Should be blocked)...');
  const agent2 = spawn('node', [agentScript], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, SERVER_URL: 'http://localhost:3000' }
  });

  let agent2Blocked = false;
  let agent2Output = '';

  agent2.stderr.on('data', (data) => {
    agent2Output += data.toString();
    if (agent2Output.includes('ALREADY RUNNING') || agent2Output.includes('STARTUP ABORTED')) {
      agent2Blocked = true;
    }
  });

  agent2.on('exit', (code) => {
    console.log(`  ✔ Agent Instance #2 exited with code ${code}`);
    assert.strictEqual(code, 1, 'Duplicate agent must exit with code 1');
    assert.ok(agent2Blocked, 'Duplicate agent must output error notice');
    console.log('  ✔ Duplicate instance was successfully blocked and terminated.\n');

    console.log('🧪 Test 3: Shutting down Agent Instance #1...');
    agent1.kill('SIGINT');

    setTimeout(() => {
      console.log('================================================================');
      console.log('🎉 ALL SINGLE-INSTANCE MUTEX TESTS PASSED (100%)!');
      console.log('================================================================\n');
      process.exit(0);
    }, 500);
  });
}, 3500);
