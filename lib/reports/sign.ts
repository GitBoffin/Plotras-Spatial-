// =====================================================================
// PLOTRAS — Certificate signing
// =====================================================================
// IMPORTANT — what this actually is:
// The PRD talks about a "digital signature" on the Spatial Clearance
// Certificate. Real PKI-based document signing (PAdES/CAdES, a
// certificate issued by a trusted CA, a timestamping authority) is
// substantial infrastructure that hasn't been built. What's here
// instead is an HMAC-SHA256 integrity stamp: proof the certificate's
// contents haven't been altered since Plotras generated it, verifiable
// by anyone hitting the /verify-signature endpoint. It is NOT legally
// equivalent to a notarized or PKI-signed document, and should not be
// described as such to end users. Before this is legally load-bearing,
// swap this for actual PKI signing (e.g. a certificate-backed PAdES
// signature via a service like DocuSign/Adobe Sign, or a self-hosted
// PKCS#11 setup).
// =====================================================================

import { createHash, createHmac, timingSafeEqual } from "crypto";

export interface CertificateFields {
  spatial_id: string;
  status: string;
  signal: "GREEN" | "YELLOW" | "RED";
  state_code: string;
  lga: string;
  issued_at: string; // ISO timestamp
  report_access_token: string;
}

function canonicalize(fields: CertificateFields): string {
  // Fixed key order, so the same fields always hash the same way.
  return [
    fields.spatial_id,
    fields.status,
    fields.signal,
    fields.state_code,
    fields.lga,
    fields.issued_at,
    fields.report_access_token,
  ].join("|");
}

// PRD FR-003: "SHA-256 hash. QR verification reference." / MVP gate:
// "Tampered document produces hash/signature failure." A bare SHA-256
// hash is trivially recomputable by anyone editing a copy of the PDF —
// what actually makes this tamper-evident is that /verify/[reportId]
// compares the printed hash against the one Plotras stored server-side
// at generation time (see certificates table), not the hash formula
// itself. This is the literal PRD requirement; the HMAC functions
// below remain as a second, independent integrity check.
export function sha256Hash(fields: CertificateFields): string {
  return createHash("sha256").update(canonicalize(fields)).digest("hex");
}

function getSecret(): string {
  const secret = process.env.REPORT_SIGNING_SECRET;
  if (!secret) {
    throw new Error("REPORT_SIGNING_SECRET is not set.");
  }
  return secret;
}

export function signCertificate(fields: CertificateFields): string {
  return createHmac("sha256", getSecret()).update(canonicalize(fields)).digest("hex");
}

export function verifyCertificateSignature(
  fields: CertificateFields,
  signature: string
): boolean {
  const expected = signCertificate(fields);
  const expectedBuf = Buffer.from(expected, "utf8");
  const givenBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== givenBuf.length) return false;
  return timingSafeEqual(expectedBuf, givenBuf);
}
