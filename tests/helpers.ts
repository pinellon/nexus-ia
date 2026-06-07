export const TEST_TOKEN = 'test-local-token';

export function configureTestSecurity() {
  process.env.NEXUS_LOCAL_TOKEN = TEST_TOKEN;
}

export function authHeaders() {
  return {
    'X-Nexus-Request': 'true',
    'X-Nexus-Token': TEST_TOKEN,
  };
}
