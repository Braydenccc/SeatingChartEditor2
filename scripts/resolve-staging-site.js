import { resolveStagingTarget } from './staging-deploy-path.js';

const branchName = process.argv[2] ?? '';

try {
  const result = resolveStagingTarget(branchName);
  process.stdout.write(JSON.stringify(result));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
