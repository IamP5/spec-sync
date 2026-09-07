import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const [projectId, uid, ...roles] = process.argv.slice(2);
if (
  !projectId ||
  !uid ||
  roles.length > 32 ||
  roles.some((role) => !/^[a-z][a-z0-9:_-]{0,63}$/.test(role))
) {
  throw new Error(
    'Usage: node apps/gateway/ops/set-user-roles.mjs PROJECT_ID UID [role ...]',
  );
}
const auth = getAuth(
  initializeApp({ credential: applicationDefault(), projectId }),
);
const user = await auth.getUser(uid);
await auth.setCustomUserClaims(uid, {
  ...user.customClaims,
  roles: [...new Set(roles)],
});
// Existing tokens carry old claims. Require a new login after every role change.
await auth.revokeRefreshTokens(uid);
console.log(`Updated roles for ${uid}; the user must sign in again.`);
