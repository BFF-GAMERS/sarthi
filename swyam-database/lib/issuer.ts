/**
 * The name printed as a certificate's issuer.
 *
 * `certificates.issuer` defaulted to 'SkillSwap', the project's earlier name, so certificates
 * carried it. Every read goes through here, which corrects those already issued. The issuer is
 * not part of the integrity hash, so this changes no verification result.
 */
export const issuerName = (raw: string | null | undefined): string =>
  !raw || /^skill\s*swap$/i.test(raw.trim()) ? "स्वYAM" : raw;
