/** Only relative application endpoints are eligible for gateway credentials. */
export function isGatewayPath(url: string): boolean {
  return /^\/(api|ai|auth|user)(\/|$)/.test(url);
}
