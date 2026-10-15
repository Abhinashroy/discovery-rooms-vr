import catalog from './data/catalog.json' with { type: 'json' };
// 193 UN members + Holy See and Palestine; other mapped territories keep map names.
// Authored memory facts, source references and verified polygon-interior landings.
export const COUNTRIES = Object.freeze(catalog.map((country) => Object.freeze(country)));
export const COUNTRY_BY_ID = Object.freeze(
  Object.fromEntries(COUNTRIES.map((country) => [country.id, country])),
);
const ALIASES = {
  VA: ['Vatican', 'Vatican City'],
  CI: ["Cote d'Ivoire"],
  TR: ['Turkiye', 'Türkiye'],
  US: ['USA', 'United States of America'],
  GB: ['UK', 'Britain', 'Great Britain'],
  CZ: ['Czech Republic'],
  TL: ['East Timor'],
  SZ: ['Swaziland'],
  CV: ['Cabo Verde'],
  MM: ['Burma'],
  KR: ['Republic of Korea'],
  KP: ['DPRK'],
  CD: ['DR Congo', 'DRC'],
  CG: ['Republic of the Congo'],
};
const normal = (text) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '');
export const matchesCountry = (country, query) =>
  normal([country.name, country.continent, ...(ALIASES[country.iso2] || [])].join(' ')).includes(
    normal(query.trim()),
  );
