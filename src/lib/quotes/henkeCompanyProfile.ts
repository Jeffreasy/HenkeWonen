export type QuoteCompanyProfile = {
  name: string;
  addressLines: string[];
  contactLine: string;
  legalLine: string;
  signatoryName: string;
};

export const henkeCompanyProfile: QuoteCompanyProfile = {
  name: "Henke Wonen",
  addressLines: ["Zuidsingel 44", "8255 CH Swifterbant"],
  contactLine: "Telefoon: 06 23163067 / Email: henkewonen@hotmail.com",
  legalLine: "Rabobank: NL54RABO0166385220 / BTW nr: NL001593768B36 / K.v.K. Lelystad: 53755200",
  signatoryName: "W. Henke."
};
