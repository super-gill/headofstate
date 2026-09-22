// Master country table. Approximate, simplified figures loosely based on ~2024.
// iso3|name|population (m)|GDP ($bn)|military spend ($bn)|gov
// gov: D liberal democracy, H hybrid / electoral, M absolute monarchy, O one-party state,
//      J military junta / armed faction, T theocracy, P personalist autocracy
const ROWS = `
USA|United States|335|29000|950|D
CAN|Canada|40|2200|27|D
MEX|Mexico|129|1850|12|H
GTM|Guatemala|18|105|0.5|H
BLZ|Belize|0.4|3.3|0.03|D
SLV|El Salvador|6.3|35|0.4|H
HND|Honduras|10|35|0.4|H
NIC|Nicaragua|6.9|17|0.2|P
CRI|Costa Rica|5.2|95|0.1|D
PAN|Panama|4.5|85|0.1|D
CUB|Cuba|11|110|0.5|O
JAM|Jamaica|2.8|20|0.1|D
HTI|Haiti|11.7|20|0.05|H
DOM|Dominican Republic|11.4|121|0.8|D
BHS|Bahamas|0.4|14|0.05|D
BRB|Barbados|0.28|6|0.04|D
TTO|Trinidad and Tobago|1.5|28|0.4|D
ATG|Antigua and Barbuda|0.1|2|0.01|D
KNA|St Kitts and Nevis|0.05|1.1|0.01|D
LCA|Saint Lucia|0.18|2.5|0.01|D
VCT|St Vincent and the Grenadines|0.1|1.1|0.01|D
GRD|Grenada|0.12|1.3|0.01|D
DMA|Dominica|0.07|0.6|0.01|D
COL|Colombia|52|400|12|D
VEN|Venezuela|28|100|2|P
GUY|Guyana|0.8|16|0.1|D
SUR|Suriname|0.6|3.5|0.1|D
BRA|Brazil|212|2170|24|D
ECU|Ecuador|18|121|2.5|H
PER|Peru|34|270|2.5|H
BOL|Bolivia|12|47|0.9|H
CHL|Chile|19.6|330|6|D
ARG|Argentina|46|630|4|D
PRY|Paraguay|6.9|43|0.5|H
URY|Uruguay|3.4|80|0.7|D
GBR|United Kingdom|68|3600|75|D
IRL|Ireland|5.3|550|1.2|D
FRA|France|68|3130|65|D
DEU|Germany|84|4700|90|D
NLD|Netherlands|17.9|1260|16|D
BEL|Belgium|11.8|640|7|D
LUX|Luxembourg|0.66|90|0.7|D
CHE|Switzerland|8.9|950|6|D
AUT|Austria|9.1|520|4|D
LIE|Liechtenstein|0.04|7|0|D
MCO|Monaco|0.04|8.6|0|D
AND|Andorra|0.08|3.7|0|D
SMR|San Marino|0.03|2|0|D
VAT|Vatican City|0.001|0.3|0|T
ITA|Italy|59|2380|38|D
ESP|Spain|48|1720|25|D
PRT|Portugal|10.4|290|5.5|D
MLT|Malta|0.54|20|0.1|D
GRC|Greece|10.4|240|8.5|D
CYP|Cyprus|0.95|33|0.6|D
DNK|Denmark|5.9|410|9.5|D
NOR|Norway|5.5|485|9.5|D
SWE|Sweden|10.5|590|11|D
FIN|Finland|5.6|300|6.5|D
ISL|Iceland|0.39|32|0|D
EST|Estonia|1.4|42|1.7|D
LVA|Latvia|1.9|43|1.8|D
LTU|Lithuania|2.9|80|2.5|D
POL|Poland|37.6|850|38|D
CZE|Czechia|10.9|340|5|D
SVK|Slovakia|5.4|140|3|D
HUN|Hungary|9.6|220|4.5|H
ROU|Romania|19|350|8|D
BGR|Bulgaria|6.4|110|2.5|D
SVN|Slovenia|2.1|70|1|D
HRV|Croatia|3.9|82|1.5|D
BIH|Bosnia and Herzegovina|3.2|28|0.3|H
SRB|Serbia|6.6|85|2.5|H
MNE|Montenegro|0.62|7|0.1|D
MKD|North Macedonia|1.8|15|0.3|H
ALB|Albania|2.8|26|0.4|H
XKX|Kosovo|1.6|10|0.1|H
MDA|Moldova|2.4|17|0.1|D
UKR|Ukraine|38|190|65|H
BLR|Belarus|9.1|72|1.5|P
RUS|Russia|144|2200|190|P
GEO|Georgia|3.7|33|0.5|H
ARM|Armenia|3|25|1.5|H
AZE|Azerbaijan|10.2|75|3|P
TUR|Turkey|85|1350|30|H
SYR|Syria|24|10|1|J
LBN|Lebanon|5.5|24|2|H
ISR|Israel|9.8|540|46|D
PSE|Palestine|5.4|17|0.3|H
JOR|Jordan|11.3|50|2.4|M
IRQ|Iraq|45|270|9|H
IRN|Iran|90|400|20|T
KWT|Kuwait|4.3|160|8|M
SAU|Saudi Arabia|36|1100|80|M
BHR|Bahrain|1.5|45|1.5|M
QAT|Qatar|2.7|220|8|M
ARE|United Arab Emirates|10.5|540|22|M
OMN|Oman|5.2|105|6.5|M
YEM|Yemen|35|20|2|J
EGY|Egypt|114|400|8|P
LBY|Libya|7|50|3|J
TUN|Tunisia|12.3|48|1.3|H
DZA|Algeria|46|265|18|P
MAR|Morocco|37.5|150|5.5|M
SDN|Sudan|49|30|2|J
SSD|South Sudan|11.5|6|0.5|P
ETH|Ethiopia|126|160|1.5|H
ERI|Eritrea|3.7|2.5|0.5|P
DJI|Djibouti|1.1|4|0.1|P
SOM|Somalia|18|12|0.3|H
KEN|Kenya|55|108|1.2|H
UGA|Uganda|49|50|1.5|P
TZA|Tanzania|68|80|0.9|H
RWA|Rwanda|14|14|0.2|P
BDI|Burundi|13.6|3|0.1|P
COD|DR Congo|105|66|0.5|H
COG|Republic of the Congo|6.1|15|0.4|P
GAB|Gabon|2.4|21|0.3|J
GNQ|Equatorial Guinea|1.7|12|0.1|P
CMR|Cameroon|28.6|50|0.6|P
CAF|Central African Republic|5.7|2.7|0.05|H
TCD|Chad|18.6|13|0.4|J
NER|Niger|27|17|0.3|J
NGA|Nigeria|227|190|2.5|H
GHA|Ghana|34|76|0.3|D
CIV|Cote d'Ivoire|29.6|85|0.7|H
BFA|Burkina Faso|23|20|0.9|J
MLI|Mali|23.3|19|0.7|J
SEN|Senegal|18|32|0.5|D
GMB|Gambia|2.8|2.3|0.03|D
GNB|Guinea-Bissau|2.2|2|0.03|J
GIN|Guinea|14.2|24|0.2|J
SLE|Sierra Leone|8.6|7.4|0.05|H
LBR|Liberia|5.6|4.5|0.02|D
MRT|Mauritania|5|11|0.3|H
CPV|Cabo Verde|0.6|2.5|0.01|D
STP|Sao Tome and Principe|0.23|0.6|0|D
TGO|Togo|9.1|9|0.1|P
BEN|Benin|14|21|0.4|H
ZMB|Zambia|21|26|0.5|H
MWI|Malawi|21|13|0.1|D
MOZ|Mozambique|34|20|0.4|H
ZWE|Zimbabwe|16.6|35|0.4|P
AGO|Angola|36|100|3|H
NAM|Namibia|3|13|0.4|D
BWA|Botswana|2.6|20|0.5|D
ZAF|South Africa|63|400|3.5|D
LSO|Lesotho|2.3|2.2|0.05|D
SWZ|Eswatini|1.2|5|0.1|M
MDG|Madagascar|31|16|0.1|H
MUS|Mauritius|1.26|15|0.05|D
SYC|Seychelles|0.1|2.1|0.02|D
COM|Comoros|0.85|1.4|0.01|H
CHN|China|1410|18700|320|O
JPN|Japan|124|4030|55|D
KOR|South Korea|51.7|1710|47|D
PRK|North Korea|26|30|8|O
TWN|Taiwan|23.4|780|17|D
MNG|Mongolia|3.4|22|0.2|D
IND|India|1430|3900|95|D
PAK|Pakistan|245|375|15|H
BGD|Bangladesh|173|450|4|H
LKA|Sri Lanka|22|85|2|D
NPL|Nepal|30|42|0.5|D
BTN|Bhutan|0.79|3|0.03|M
MDV|Maldives|0.52|6.5|0.1|H
AFG|Afghanistan|42|17|0.5|T
MMR|Myanmar|55|65|3|J
THA|Thailand|71|530|6|H
LAO|Laos|7.6|15|0.3|O
KHM|Cambodia|17|45|1|P
VNM|Vietnam|100|470|6|O
MYS|Malaysia|34|420|4.5|D
SGP|Singapore|5.9|530|13|H
BRN|Brunei|0.45|15|0.5|M
IDN|Indonesia|280|1400|10|D
TLS|Timor-Leste|1.4|2.1|0.03|D
PHL|Philippines|117|470|4.5|D
KAZ|Kazakhstan|20|290|2|P
UZB|Uzbekistan|36|115|2|P
TKM|Turkmenistan|6.5|55|0.4|P
KGZ|Kyrgyzstan|7|15|0.3|P
TJK|Tajikistan|10|14|0.4|P
AUS|Australia|27|1750|33|D
NZL|New Zealand|5.3|250|3.7|D
PNG|Papua New Guinea|10.3|32|0.1|D
FJI|Fiji|0.93|5.5|0.1|D
SLB|Solomon Islands|0.75|1.6|0.01|D
VUT|Vanuatu|0.33|1.1|0|D
WSM|Samoa|0.22|0.9|0|D
TON|Tonga|0.1|0.5|0|M
KIR|Kiribati|0.13|0.3|0|D
FSM|Micronesia|0.11|0.4|0|D
MHL|Marshall Islands|0.04|0.3|0|D
PLW|Palau|0.018|0.3|0|D
NRU|Nauru|0.01|0.15|0|D
`;

// Features on the base map that are not sovereign states, folded into their parent
const TERRITORY_PARENT = {
  'Puerto Rico': 'USA', 'U.S. Virgin Is.': 'USA', 'Guam': 'USA', 'American Samoa': 'USA', 'N. Mariana Is.': 'USA',
  'S. Geo. and the Is.': 'GBR', 'Br. Indian Ocean Ter.': 'GBR', 'Saint Helena': 'GBR', 'Pitcairn Is.': 'GBR',
  'Anguilla': 'GBR', 'Falkland Is.': 'GBR', 'Cayman Is.': 'GBR', 'Bermuda': 'GBR', 'British Virgin Is.': 'GBR',
  'Turks and Caicos Is.': 'GBR', 'Montserrat': 'GBR', 'Jersey': 'GBR', 'Guernsey': 'GBR', 'Isle of Man': 'GBR',
  'Niue': 'NZL', 'Cook Is.': 'NZL',
  'Aruba': 'NLD', 'Curaçao': 'NLD', 'Sint Maarten': 'NLD',
  'W. Sahara': 'MAR',
  'St. Pierre and Miquelon': 'FRA', 'Wallis and Futuna Is.': 'FRA', 'St-Martin': 'FRA', 'St-Barthélemy': 'FRA',
  'Fr. Polynesia': 'FRA', 'New Caledonia': 'FRA', 'Fr. S. Antarctic Lands': 'FRA',
  'Åland': 'FIN', 'Greenland': 'DNK', 'Faeroe Is.': 'DNK', 'N. Cyprus': 'CYP',
  'Macao': 'CHN', 'Hong Kong': 'CHN',
  'Indian Ocean Ter.': 'AUS', 'Heard I. and McDonald Is.': 'AUS', 'Norfolk Island': 'AUS', 'Ashmore and Cartier Is.': 'AUS',
  'Siachen Glacier': 'IND', 'Somaliland': 'SOM', 'Kosovo': 'XKX',
  'Antarctica': null,
};

// Sovereign rows to tweak. nukes: 2 = superpower arsenal, 1 = smaller arsenal
const NUKES = { USA: 2, RUS: 2, CHN: 1, FRA: 1, GBR: 1, IND: 1, PAK: 1, ISR: 1, PRK: 1 };
const TECH = { USA: 5, CHN: 4, JPN: 5, KOR: 5, ISR: 5, DEU: 5, FRA: 5, GBR: 5, TWN: 5, RUS: 4, IND: 3, UKR: 4, TUR: 4,
  SGP: 4, AUS: 4, CAN: 4, ITA: 4, ESP: 4, NLD: 4, SWE: 5, NOR: 4, FIN: 4, POL: 4, ARE: 4, SAU: 3, IRN: 3, PRK: 3, PAK: 3, BRA: 3, CHE: 4 };
const FRAGILE = ['HTI', 'SOM', 'SDN', 'SSD', 'YEM', 'LBY', 'SYR', 'MMR', 'AFG', 'COD', 'CAF', 'MLI', 'BFA', 'NER', 'TCD', 'LBN', 'ETH', 'BDI', 'NGA', 'MOZ', 'PSE', 'IRQ', 'VEN', 'GNB', 'HND'];
const DEBT = { JPN: 250, USA: 122, ITA: 140, GRC: 150, FRA: 112, GBR: 101, ESP: 105, BEL: 105, PRT: 95, CAN: 105, BRA: 87, IND: 82, CHN: 90,
  LBN: 170, SDN: 100, ZWE: 100, ARG: 85, EGY: 90, PAK: 75, ZAF: 75, LKA: 100, KEN: 70, GHA: 80, ISR: 68, ESH: 0,
  NOR: 40, SWE: 33, DNK: 30, CHE: 38, FIN: 78, NLD: 46, DEU: 63, AUS: 50, NZL: 45, KOR: 55, SGP: 170, IRL: 40, LUX: 25, EST: 20, LTU: 38, LVA: 44, CZE: 44, POL: 50, HUN: 73, ROU: 50, SVK: 58, SVN: 68, HRV: 58, AUT: 78, ISL: 65,
  RUS: 20, SAU: 26, ARE: 30, QAT: 40, KWT: 5, OMN: 40, BHR: 130, TUR: 30, IDN: 40, MEX: 55, CHL: 40, COL: 55, PER: 33, URY: 65, MYS: 65, THA: 62, VNM: 35, PHL: 60, NGA: 45, ETH: 50, DZA: 60, MAR: 70, TUN: 80, JOR: 90, UKR: 85, MNG: 65, BOL: 80, MOZ: 100, SEN: 80, ZMB: 100, AGO: 65, COD: 15, CMR: 45, KAZ: 25, UZB: 35, ARM: 48, GEO: 40, AZE: 20, BLR: 40, SRB: 52, ALB: 60, VEN: 150, CUB: 90, HTI: 30 };
const GROWTH_OVERRIDE = { CHN: 4.2, IND: 5.6, VNM: 6, IDN: 5, PHL: 5.5, BGD: 5, ETH: 6, RWA: 6, GUY: 15, ARE: 4, SAU: 3, IRN: 2, RUS: 2, UKR: 2.5 };
const AGGRESSION = { RUS: 0.6, CHN: 0.4, IRN: 0.5, PRK: 0.65, ISR: 0.45, TUR: 0.4, USA: 0.3, IND: 0.25, PAK: 0.4, AZE: 0.4, RWA: 0.4, ETH: 0.35, ERI: 0.4, VEN: 0.35 };

// Blocs. type: defence (mutual defence pact), union (economic + political + mutual aid), political (loose grouping)
const BLOCS = [
  { id: 'NATO', name: 'NATO', type: 'defence', desc: 'Transatlantic mutual defence pact. An attack on one is an attack on all.',
    members: 'USA CAN GBR FRA DEU ITA ESP PRT NLD BEL LUX DNK NOR ISL POL CZE SVK HUN ROU BGR HRV SVN ALB MNE MKD GRC TUR EST LVA LTU FIN SWE' },
  { id: 'EU', name: 'European Union', type: 'union', desc: 'Single market, common trade policy and a mutual assistance clause.',
    members: 'AUT BEL BGR HRV CYP CZE DNK EST FIN FRA DEU GRC HUN IRL ITA LVA LTU LUX MLT NLD POL PRT ROU SVK SVN ESP SWE' },
  { id: 'CSTO', name: 'CSTO', type: 'defence', desc: 'Russia-led collective security treaty.', members: 'RUS BLR ARM KAZ KGZ TJK' },
  { id: 'SCO', name: 'Shanghai Cooperation Organisation', type: 'political', desc: 'Eurasian security and economic grouping.',
    members: 'CHN RUS IND PAK IRN KAZ KGZ TJK UZB BLR' },
  { id: 'BRICS', name: 'BRICS+', type: 'political', desc: 'Emerging-economy grouping pushing for a multipolar order.',
    members: 'BRA RUS IND CHN ZAF EGY ETH IRN ARE IDN' },
  { id: 'ASEAN', name: 'ASEAN', type: 'union', desc: 'Southeast Asian economic and diplomatic community.',
    members: 'IDN MYS PHL SGP THA VNM BRN KHM LAO MMR TLS' },
  { id: 'AU', name: 'African Union', type: 'political', desc: 'Continental body for African states.',
    members: 'DZA AGO BEN BWA BFA BDI CMR CPV CAF TCD COM COG COD CIV DJI EGY GNQ ERI SWZ ETH GAB GMB GHA GIN GNB KEN LSO LBR LBY MDG MWI MLI MRT MUS MAR MOZ NAM NER NGA RWA STP SEN SYC SLE SOM ZAF SSD SDN TZA TGO TUN UGA ZMB ZWE' },
  { id: 'ARAB', name: 'Arab League', type: 'political', desc: 'Political grouping of Arab states.',
    members: 'DZA BHR COM DJI EGY IRQ JOR KWT LBN LBY MRT MAR OMN PSE QAT SAU SOM SDN SYR TUN ARE YEM' },
  { id: 'GCC', name: 'Gulf Cooperation Council', type: 'defence', desc: 'Gulf monarchies\' economic and defence bloc.', members: 'SAU ARE QAT KWT BHR OMN' },
  { id: 'MERCOSUR', name: 'Mercosur', type: 'union', desc: 'South American common market.', members: 'ARG BRA PRY URY BOL' },
  { id: 'AUKUS', name: 'AUKUS', type: 'defence', desc: 'Trilateral Indo-Pacific security pact.', members: 'USA GBR AUS' },
];
// Bilateral defence treaties
const PACTS = [
  'USA JPN', 'USA KOR', 'USA PHL', 'USA AUS', 'USA NZL', 'AUS NZL',
  'RUS BLR', 'RUS PRK', 'CHN PRK', 'PAK SAU', 'TUR AZE', 'FRA GRC', 'FRA ARE',
];
// Rivalries: pair, intensity 1 (frosty) to 3 (bitter), label
const RIVALRIES = [
  'RUS UKR 3 Invasion and occupation', 'RUS POL 2 Eastern flank', 'RUS EST 2 Baltic tension', 'RUS LVA 2 Baltic tension', 'RUS LTU 2 Baltic tension',
  'RUS FIN 1 New NATO border', 'RUS GEO 2 2008 war and occupied regions', 'RUS MDA 1 Transnistria', 'RUS USA 2 Great-power rivalry', 'RUS GBR 2 Espionage and sanctions',
  'CHN TWN 3 Sovereignty dispute', 'CHN JPN 2 Islands and history', 'CHN IND 2 Himalayan border', 'CHN PHL 2 South China Sea', 'CHN VNM 1 South China Sea',
  'CHN USA 2 Strategic rivalry', 'CHN AUS 1 Trade and security', 'CHN KOR 1 Missile defence', 'USA IRN 3 Sanctions and proxies', 'USA PRK 3 Nuclear standoff',
  'USA CUB 2 Embargo', 'USA VEN 2 Sanctions', 'IND PAK 3 Kashmir and nuclear rivalry', 'PAK AFG 2 Border and militancy',
  'ISR IRN 3 Shadow war', 'ISR PSE 3 Occupation and conflict', 'ISR LBN 2 Northern border', 'ISR SYR 1 Golan', 'ISR YEM 1 Missiles',
  'ISR TUR 1 Diplomatic rift', 'PRK KOR 3 Divided peninsula', 'JPN KOR 1 Historical disputes', 'JPN PRK 2 Missile launches', 'JPN RUS 1 Kuril Islands',
  'SAU IRN 2 Regional rivalry', 'ARE IRN 1 Islands dispute', 'TUR GRC 2 Aegean disputes', 'TUR CYP 2 Cyprus question', 'TUR ARM 1 Historical grievance',
  'ARM AZE 3 Nagorno-Karabakh', 'ETH ERI 2 Border and Red Sea access', 'ETH EGY 2 Nile dam', 'ETH SOM 1 Port deal', 'RWA COD 3 Eastern Congo conflict',
  'MAR DZA 2 Western Sahara', 'SRB XKX 3 Kosovo status', 'VEN GUY 2 Essequibo claim', 'ARG GBR 1 Falkland Islands', 'BOL CHL 1 Sea access',
  'THA KHM 2 Border clashes', 'KGZ TJK 2 Border disputes', 'BLR POL 2 Border crisis', 'BLR LTU 1 Border crisis', 'SDN SSD 1 Oil and border',
  'IRN IRQ 1 Legacy of war', 'IND BGD 1 Water and borders', 'CHN BTN 1 Border claims', 'KEN SOM 1 Maritime dispute',
];
// Wars in progress at the start of the default scenario: attacker defender
const START_WARS = ['RUS UKR'];

module.exports = { ROWS, TERRITORY_PARENT, NUKES, TECH, FRAGILE, DEBT, GROWTH_OVERRIDE, AGGRESSION, BLOCS, PACTS, RIVALRIES, START_WARS };
