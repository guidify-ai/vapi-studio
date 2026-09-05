/**
 * JWT HS256 (HMAC) helpers for outbound integration auth.
 * No extra dependency — Node crypto only.
 */
export declare const INTEGRATION_SIGNATURE_HEADER = "x-signature";
export interface IntegrationJwtClaims {
    iat: number;
    exp: number;
    method: string;
    url: string;
    bodySha256: string;
}
export declare function sha256Hex(body: string): string;
export declare function canonicalRequestBody(body: unknown): string;
export declare function readSecretEnv(secretEnvKey: string): string;
export declare function signHs256Jwt(claims: Record<string, unknown>, secret: string): string;
export declare function verifyHs256Jwt(token: string, secret: string): IntegrationJwtClaims;
/**
 * Sign the exact body bytes that will be sent.
 * JWT is placed on `x-signature` by the integration client.
 */
export declare function signIntegrationRequest(input: {
    secret: string;
    method: string;
    url: string;
    body: string;
    ttlSeconds?: number;
}): {
    token: string;
    bodySha256: string;
    claims: IntegrationJwtClaims;
};
//# sourceMappingURL=jwt-hmac.d.ts.map