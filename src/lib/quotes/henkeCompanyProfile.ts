export type QuoteCompanyProfile = {
  name: string;
  logoUrl: string;
  addressLines: string[];
  contactLine: string;
  legalLine: string;
  signatoryName: string;
  /** IBAN voor betaalinstructies op de factuur. */
  iban?: string;
};

export const henkeCompanyProfile: QuoteCompanyProfile = {
  name: "Henke Wonen",
  logoUrl: "/images/logo-henke-wonen.png",
  addressLines: ["Zuidsingel 44", "8255 CH Swifterbant"],
  contactLine: "Telefoon: 06 23163067 / Email: henkewonen@hotmail.com",
  legalLine: "Rabobank: NL54RABO0166385220 / BTW nr: NL001593768B36 / K.v.K. Lelystad: 53755200",
  signatoryName: "W. Henke.",
  iban: "NL54RABO0166385220"
};
