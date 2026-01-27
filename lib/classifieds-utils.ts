export const DIVISION_LABELS: Record<string, string> = {
  liga_heren: "LIGA HEREN",
  liga_dames: "LIGA DAMES",
  nat1_heren: "Nationale 1 Heren",
  nat2_heren: "Nationale 2 Heren",
  nat3_heren: "Nationale 3 Heren",
  nat1_dames: "Nationale 1 Dames",
  nat2_dames: "Nationale 2 Dames",
  nat3_dames: "Nationale 3 Dames",
  promo1_heren: "PROMO 1 Heren",
  promo2_heren: "PROMO 2 Heren",
  promo3_heren: "PROMO 3 Heren",
  promo1_dames: "PROMO 1 Dames",
  promo2_dames: "PROMO 2 Dames",
  promo3_dames: "PROMO 3 Dames",
  promo4_dames: "PROMO 4 Dames",
};

export const PROVINCE_LABELS: Record<string, string> = {
  antwerpen: "Antwerpen",
  limburg: "Limburg",
  oost_vlaanderen: "Oost-Vlaanderen",
  vlaams_brabant: "Vlaams-Brabant",
  west_vlaanderen: "West-Vlaanderen",
  henegouwen: "Henegouwen",
  waals_brabant: "Waals-Brabant",
  namen: "Namen",
  luik: "Luik",
  luxemburg: "Luxemburg",
  frankrijk: "Frankrijk",
  zwitserland: "Zwitserland",
  turkije: "Turkije",
  nederland: "Nederland",
};

export function getDivisionLabel(value: string | null): string {
  if (!value) return "";
  return DIVISION_LABELS[value] || value;
}

export function getProvinceLabel(value: string | null): string {
  if (!value) return "";
  return PROVINCE_LABELS[value] || value;
}
