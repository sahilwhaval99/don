import { executeRound, RoundResult } from './verify-round.js';

async function main() {
  console.log('================================================================');
  console.log('   DON (Digital Operations Navigator) - TEN VERIFICATION ROUNDS');
  console.log('================================================================\n');

  const results: RoundResult[] = [];
  let allPassed = true;
  const overallStart = Date.now();

  for (let r = 1; r <= 10; r++) {
    console.log(`\n>>> STARTING ROUND ${r} OF 10 <<<`);
    try {
      const res = executeRound(r);
      results.push(res);
      console.log(`[PASS] Round ${r}: ${res.name} (${res.durationMs}ms)`);
    } catch (err: unknown) {
      allPassed = false;
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        round: r,
        name: `Round ${r}`,
        status: 'FAILED',
        durationMs: 0,
        details: msg,
      });
      console.error(`[FAIL] Round ${r} FAILED:`, msg);
      break; // Stop on first failure
    }
  }

  const overallDuration = ((Date.now() - overallStart) / 1000).toFixed(2);

  console.log('\n================================================================');
  console.log('                   VERIFICATION ROUND SUMMARY');
  console.log('================================================================');
  console.log('| Round | Status | Time (ms) | Verification Scope');
  console.log('|-------|--------|-----------|----------------------------------');
  for (const res of results) {
    const padRound = String(res.round).padEnd(5);
    const padStatus = res.status.padEnd(6);
    const padTime = String(res.durationMs).padStart(9);
    console.log(`| ${padRound} | ${padStatus} | ${padTime} | ${res.name}`);
  }
  console.log('================================================================');
  console.log(`Total Execution Time: ${overallDuration}s`);

  if (allPassed && results.length === 10) {
    console.log('\n🏆 ALL 10 VERIFICATION ROUNDS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('\n❌ VERIFICATION FAILED. Review details above.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error during verification run:', err);
  process.exit(1);
});
