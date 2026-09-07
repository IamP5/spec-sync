export const gatewayChecks = {
  name: 'gateway',
  paths: ['apps/gateway/', 'tools/deploy/gateway.sh'],
  fastSteps: [
    'npx nx run gateway:lint',
    'npx nx run gateway:typecheck',
    'npx nx run gateway:test',
  ],
  fullOnlySteps: ['npx nx run gateway:build'],
};
