// Comprehensive Kenya Counties, Sub-Counties, and Wards dataset
// Source: Kenya National Bureau of Statistics (KNBS) / IEBC
// Priority: Kiambu County (most detailed)

export interface SubCounty {
  name: string;
  wards?: string[];
}

export interface CountyData {
  name: string;
  capital: string;
  subcounties: SubCounty[];
}

export const KENYA_COUNTY_DATA: CountyData[] = [
  {
    name: 'Baringo',
    capital: 'Kabarnet',
    subcounties: [
      { name: 'Baringo Central', wards: ['Kabarnet', 'Lembus', 'Emining', 'Mukutani'] },
      { name: 'Baringo North', wards: ['Barwessa', 'Kabartonjo', 'Saimo Soi', 'Tenges'] },
      { name: 'Baringo South', wards: ['Mochongoi', 'Mogotio', 'Ewuaso Ondong\'i'] },
      { name: 'Eldama Ravine', wards: ['Eldama Ravine', 'Hurmur', 'Koibatek'] },
      { name: 'Mogotio', wards: ['Mogotio', 'Lake Baringo'] },
      { name: 'Tiaty', wards: ['Kab Cherwananyuk', 'Kaboskek', 'Kaplelach', 'Kisanana', 'Nyukro'] },
    ],
  },
  {
    name: 'Bomet',
    capital: 'Bomet',
    subcounties: [
      { name: 'Bomet Central', wards: ['Bomet Central', 'Silibwet Township', 'Ndaraweta', 'Singorwet'] },
      { name: 'Bomet East', wards: ['Chemaner', 'Kongoni', 'Longisa'] },
      { name: 'Chepalungu', wards: ['Amalo', 'Kiplokyo', 'Torit', 'Chebunyo'] },
      { name: 'Konoin', wards: ['Cheptalal', 'Koiwa', 'Lembus Perkerra', 'Sigor'] },
      { name: 'Sotik', wards: ['Kipsonoi', 'Light Safari', 'Ngerengere', 'Kenyenya'] },
    ],
  },
  {
    name: 'Bungoma',
    capital: 'Bungoma',
    subcounties: [
      { name: 'Bumula', wards: ['Bumula', 'Khalaba', 'Musikoma', 'South Bukusu', 'West Bukusu'] },
      { name: 'Kanduyi', wards: ['Bukembe', 'Kanduyi', 'Khalandira', 'Mihuu', 'Songhor/Sirisia', 'Tongaren'] },
      { name: 'Kwangamaro', wards: ['Khangamaro', 'Mukuyuni', 'North Bukusu', 'Ndalu/Chwele', 'Webuye'] },
      { name: 'Malakisi', wards: ['Malakisi', 'South Marachi', 'Tongaren'] },
      { name: 'Mt. Elgon', wards: ['Cheptais', 'Chewei', 'Koone', 'Mt. Elgon', 'Sirisia'] },
      { name: 'Webuye', wards: ['Bokoli', 'Kimilili', 'Maraka', 'Mukuyuni', 'Ndalu', 'Webuye'] },
    ],
  },
  {
    name: 'Busia',
    capital: 'Busia',
    subcounties: [
      { name: 'Bunyala', wards: ['Bunyala Central', 'Bunyala North', 'Bunyala South', 'Bunyala West'] },
      { name: 'Butula', wards: ['Butula', 'Elukongo', 'Kingandole', 'Marachi Central', 'Marachi East', 'Marachi North'] },
      { name: 'Funyula', wards: ['Funyula Central', 'Funyula North', 'Funyula South', 'Nambale'] },
      { name: 'Teso North', wards: ['Amukura Central', 'Amukura East', 'Amukura West', 'Malaba Central', 'Malaba North', 'Malaba South'] },
      { name: 'Teso South', wards: ['Achuni', 'Amukura', 'Angurai', 'Chakol South', 'Malaba South', 'Petkoman'] },
    ],
  },
  {
    name: 'Elgeyo-Marakwet',
    capital: 'Iten',
    subcounties: [
      { name: 'Keiyo North', wards: ['Arror', 'Emsoo', 'Kamariny', 'Kapchebau', 'Kaplamai', 'Muko', 'Tambach'] },
      { name: 'Keiyo South', wards: ['Bugar', 'Kabiemit', 'Kamwosor', 'Kessup', 'Koiber', 'Moiben', 'Sengwer'] },
      { name: 'Marakwet East', wards: ['Endo', 'Kapsowar', 'Kolowa', 'Samburu', 'Tuloi'] },
      { name: 'Marakwet West', wards: ['Chapkumong', 'Kapyego', 'Kimnai', 'Murkoros', 'Samburu', 'Tambach'] },
    ],
  },
  {
    name: 'Embu',
    capital: 'Embu',
    subcounties: [
      { name: 'Embu Central', wards: ['Embu East', 'Embu North', 'Embu South', 'Embu West', 'Kiamokama'] },
      { name: 'Embu North', wards: ['Evurore', 'Kirimiri', 'Kirimuri', 'Mbeti South', 'Muminji', 'Nembure'] },
      { name: 'Embu South', wards: ['Gaturi South', 'Kagari', 'Makima', 'Mavuria', 'Mwea', 'Nthawa'] },
      { name: 'Manyatta', wards: ['Gaturi North', 'Kangaru', 'Kathri Central', 'Mbari-Ya-Njoroge', 'Muchonoke', 'Njukiri', 'Nthawa'] },
      { name: 'Mbeere North', wards: ['Bitungi', 'Kiangai', 'Kivou', 'Mbeere', 'Mbeti North', 'Muminji'] },
      { name: 'Mbeere South', wards: ['Gaturi', 'Kagari', 'Makima', 'Mavuria', 'Mwea', 'Nthawa'] },
    ],
  },
  {
    name: 'Garissa',
    capital: 'Garissa',
    subcounties: [
      { name: 'Garissa Central', wards: ['Garissa Central', 'Iftin', 'Korakora', 'Mujwa', 'Munyu'] },
      { name: 'Garissa Township', wards: ['Bura', 'Dadaab', 'Hulugho', 'Ijara', 'Lafey', 'Sala'] },
      { name: 'Ijara', wards: ['Ijara', 'Sangailu', 'Masalani', 'Hulugho'] },
      { name: 'Dadaab', wards: ['Dadaab', 'Hagadera', 'Damajale', 'Liboi', 'Abdisamit'] },
    ],
  },
  {
    name: 'Homa Bay',
    capital: 'Homa Bay',
    subcounties: [
      { name: 'Homa Bay Central', wards: ['Biashara', 'Kanyabolu', 'Kanyadhiang', 'Kendu Bay', 'Rangwe'] },
      { name: 'Homa Bay Town', wards: ['Air Bay', 'Central Kanyadhiang', 'Kanyabolu', 'Rangwe'] },
      { name: 'Kabondo Kasipul', wards: ['Kabondo Central', 'Kakach Karonde', 'Kanyamach', 'Kendu Bay', 'Kwangamai', 'Rangwe'] },
      { name: 'Karachuonyo', wards: ['Kanyadhiang', 'Karachuonyo Central', 'Kanyadhiang', 'Kwangamai', 'North Karachuonyo', 'Rangwe'] },
      { name: 'Mbita', wards: ['Gembe', 'Kiangindo', 'Kaksingri', 'Mfangano', 'Rusinga'] },
      { name: 'Ndhiwa', wards: ['Kanyamidia', 'Kendu Bay', 'Kwabwai', 'Ndhiwa', 'Rombo'] },
      { name: 'Rangwe', wards: ['Kanyadhiang', 'Kwajwang', 'Kwambwai', 'Rangwe', 'Tai'] },
      { name: 'Suba', wards: ['Gwassi', 'Kasgunga', 'Kigoto', 'Kitimi', 'Lambwe', 'Mfangano', 'Sumba'] },
    ],
  },
  {
    name: 'Isiolo',
    capital: 'Isiolo',
    subcounties: [
      { name: 'Isiolo Central', wards: ['Isiolo Central', 'Isiolo Township', 'Olderes', 'Wabera'] },
      { name: 'Isiolo North', wards: ['Bula Pesa', 'Chari', 'Chumvi', 'Kinna', 'Merille', 'Sera'] },
      { name: 'Isiolo South', wards: ['Garba Tulla', 'Kipsing', 'Longopito', 'Modogashe', 'Sericho'] },
    ],
  },
  {
    name: 'Kajiado',
    capital: 'Kajiado',
    subcounties: [
      { name: 'Kajiado Central', wards: ['Isinya', 'Kajiado Central', 'Kajiado North', 'Namelok', 'Purdy', 'Telela'] },
      { name: 'Kajiado North', wards: ['Athi River', 'Kitengela', 'Kiserian', 'Ngong', 'Ongata Rongai'] },
      { name: 'Kajiado South', wards: ['Isinya', 'Kaputiei North', 'Kitengela', 'Mavoko', 'Namelok', 'Ongata Rongai'] },
      { name: 'Kajiado West', wards: ['Matapato North', 'Matapato South', 'Torosei', 'Imbirikani'] },
      { name: 'Loitokitok', wards: ['Imbirikani', 'Kenyirima', 'Kilimanjaro', 'Loitokitok', 'Rombo', 'Sagala'] },
      { name: 'Mashuru', wards: ['Ildamat', 'Kaputiei North', 'Kilikia', 'Mashuru', 'Olpul'] },
    ],
  },
  {
    name: 'Kakamega',
    capital: 'Kakamega',
    subcounties: [
      { name: 'Kakamega Central', wards: ['Inbox', 'Kisumu North', 'Municipality', 'Shiru', 'West Saints'] },
      { name: 'Kakamega East', wards: ['East Kabras', 'Mukumu', 'Murhula', 'Shiraha', 'Shisehere'] },
      { name: 'Kakamega North', wards: ['Chevaywa', 'Kwisio', 'Lurambi', 'Mautuma', 'North Kabras', 'Sarusi'] },
      { name: 'Kakamega South', wards: ['Buhuyi', 'Bukaya', 'Ikolomani', 'Idavaya', 'Mukoma', 'Shibuli'] },
      { name: 'Lurambi', wards: ['Lurambi', 'Mukumu', 'Murhula', 'Shiraha', 'Shisehere'] },
      { name: 'Matungu', wards: ['Central Kabras', 'Koyonzo', 'Kulumbusi', 'Matungu', 'North Kabras', 'South Kabras'] },
      { name: 'Mumias Central', wards: ['Bukura', 'Epongo', 'Lwanda', 'Mautuma', 'Mumias Central', 'Musanda'] },
      { name: 'Mumias East', wards: ['Bujubi', 'Khalabwai', 'Lwanda', 'Malaha', 'Mautuma', 'Musingu'] },
      { name: 'Mumias West', wards: ['Bukuru', 'Epongo', 'Isongo', 'Khalabwai', 'Musingu', 'Shibuye'] },
      { name: 'Navakholo', wards: ['Emukhalari', 'Ingotso', 'Kambiri', 'Makhoko', 'Mamboleo', 'Navakholo', 'Shikoti'] },
    ],
  },
  {
    name: 'Kericho',
    capital: 'Kericho',
    subcounties: [
      { name: 'Kericho Central', wards: ['Ainamoi', 'Kapsoit', 'Kericho', 'Kipkelyoi', 'Roret', 'Sosiot'] },
      { name: 'Kipkelion East', wards: ['Chilchila', 'Kedowet', 'Kipkelion', 'Londiani', 'Masaita'] },
      { name: 'Kipkelion West', wards: ['Cherangani', 'Kabusundet', 'Kamasian', 'Kipkelion', 'Kunyak'] },
      { name: 'Sigowet/Soin', wards: ['Karbosei', 'Komotoi', 'Sigowet', 'Soin'] },
      { name: 'Bureti', wards: ['Chamwada', 'Chemoibet', 'Kabiaget', 'Kapsolet', 'Koisagat', 'Litein', 'Tebesonik'] },
      { name: 'Belgut', wards: ['Chepkutum', 'Cheptongei', 'Kabiaget', 'Kapkatet', 'Kiptoror', 'Nzirani'] },
    ],
  },
  {
    name: 'Kiambu',
    capital: 'Kiambu',
    subcounties: [
      { name: 'Gatundu North', wards: ['Gatundu', 'Kiamwangi', 'Kiganjo', 'Mũthitha', 'Ndarugo', 'Ng\'enda'] },
      { name: 'Gatundu South', wards: ['Atalaku', 'Gatundu', 'Gituamba', 'Kiganjo', 'Mũthitha', 'Ndarugo'] },
      { name: 'Githunguri', wards: ['Githiga', 'Githunguri', 'Ikinu', 'Kabete', 'Kamiti', 'Komothai'] },
      { name: 'Juja', wards: ['Fontanhe', 'Garison', 'Juja', 'Kalimoni', 'Mugutha', 'Thika'] },
      { name: 'Kabete', wards: ['Kabete', 'Kikuyu', 'Kiambaa', 'Kiambu', 'Uthiru'] },
      { name: 'Kiambaa', wards: ['Cianda', 'Karuri', 'Kihara', 'Kiambaa', 'Muchatha', 'Ndenderu'] },
      { name: 'Kiambu Central', wards: ['Kalimoni', 'Kiamichie', 'Kiambu', 'Township', 'Thogoto'] },
      { name: 'Kiambu East', wards: ['Hotcomplex', 'Kaithi', 'Kiangai', 'Kilimambogo', 'Kïmaathi', 'Mutunguru'] },
      { name: 'Kiambu West', wards: ['Githukii', 'Kambu', 'Mukurii', 'Kiambari', 'Githuru', 'Mikarui', 'Kahawa'] },
      { name: 'Kikuyu', wards: ['Kikuyu', 'Nduma', 'Thogoto', 'Karuri', 'Uthiru'] },
      { name: 'Limuru', wards: ['Baba Ndogo', 'Limuru', 'Mabirini', 'Mangu', 'Ndeiya', 'Tigithi'] },
      { name: 'Lari', wards: ['Kijabe', 'Kirenga', 'Lari', 'Mũkũrĩ', 'Ndarugo', 'Tigoni'] },
      { name: 'Mathioya', wards: ['Gathima', 'Kagumo', 'Kamacharia', 'Mathioya', 'Mũhũrũ', 'Ndathi'] },
      { name: 'Ruiru', wards: ['Gatongora', 'Kahawa', 'Kahawa Wendani', 'Kihunguro', 'Mũgithi', 'Ruiru'] },
      { name: 'Thika', wards: ['Jobelin', 'Kokwir', 'Nia Mala', 'Thika', 'Witeithie', 'Zone 2'] },
      { name: 'Thika Town', wards: ['Hospital', 'Kiganjo', 'Maringa', 'Murera', 'Ngoliba', 'Thika'] },
    ],
  },
  {
    name: 'Kilifi',
    capital: 'Kilifi',
    subcounties: [
      { name: 'Kilifi Central', wards: ['Junju', 'Mwarakaya', 'Shirikisha', 'Sokoroni', 'Tezo'] },
      { name: 'Kilifi North', wards: ['Chasimba', 'Dabaso', 'Jeferson', 'Kadzunje', 'Kauri', 'Mwarakaya', 'Nanighi'] },
      { name: 'Kilifi South', wards: ['Bamba', 'Dzitsoni', 'Junju', 'Mwahera', 'Mwarakaya', 'Sokoroni'] },
      { name: 'Magarini', wards: ['Adu', 'Ganda', 'Jaribuni', 'Mikoroshoni', 'Nanighi', 'Savani'] },
      { name: 'Malindi', wards: ['Gede', 'Kakuyuni', 'Kilifi', 'Malaisha', 'Mambrui', 'Shella'] },
      { name: 'Rabai', wards: ['Arabuko', 'Chonyi', 'Jibana', 'Kambe', 'Ribe', 'Ruruma'] },
    ],
  },
  {
    name: 'Kirinyaga',
    capital: 'Kerugoya',
    subcounties: [
      { name: 'Kirinyaga Central', wards: ['Baricho', 'Kerugoya', 'Kianyaga', 'Makutano', 'Muthambi'] },
      { name: 'Kirinyaga East', wards: ['Kabare', 'Kagumo', 'Kangai', 'Thiba'] },
      { name: 'Kirinyaga South', wards: ['Gathigiriri', 'Karumandi', 'Mwea', 'Mutithi', 'Wamumu'] },
      { name: 'Kirinyaga West', wards: ['Kagoya', 'Kamukuywa', 'Kiangai', 'Makutano', 'Ngariama'] },
      { name: 'Mwea', wards: ['Gathigiriri', 'Karumandi', 'Kathima', 'Kiaga', 'Murinduko', 'Mutithi', 'Nyangiti', 'Wamumu'] },
    ],
  },
  {
    name: 'Kisii',
    capital: 'Kisii',
    subcounties: [
      { name: 'Kisii Central', wards: ['Borabu', 'Itumbe', 'Kitutu Central', 'Nyakoe', 'Suneka'] },
      { name: 'Kisii East', wards: ['Getenga', 'Kegogi', 'Monyerero', 'Nyamage', 'Sengera'] },
      { name: 'Kisii North', wards: ['Bogiakumu', 'Etago', 'Itibo', 'Kitutu', 'Machogu', 'Nyamache'] },
      { name: 'Kisii South', wards: ['Bogetenga', 'Borabu', 'Kekenyi', 'Keumbu', 'Kiogoro', 'Nyaronde'] },
      { name: 'Gucha', wards: ['Etago', 'Komotobo', 'Nyamoko', 'Oguto', 'Sagara'] },
      { name: 'Gucha South', wards: ['Igara', 'Nyambararia', 'Nyamoso', 'Nyanguru', 'Roambur'] },
      { name: 'Nyamira North', wards: ['Ekerenyo', 'Itibo', 'Manga', 'Masaba', 'Nyamira'] },
      { name: 'Nyamira South', wards: ['Borabu', 'Kiabonyoru', 'Nyansiongo', 'Nyamira', 'Rhonda'] },
    ],
  },
  {
    name: 'Kisumu',
    capital: 'Kisumu',
    subcounties: [
      { name: 'Kisumu Central', wards: ['Kajulu', 'Kolwa Central', 'Manyatta A', 'Manyatta B', 'Nyalenda A', 'Nyalenda B'] },
      { name: 'Kisumu East', wards: ['Kajulu', 'Kolwa East', 'Kolwa West', 'Nyalenda', 'Seme East', 'Seme West'] },
      { name: 'Kisumu West', wards: ['Kajulu', 'Kolwa Central', 'Kolwa East', 'Kolwa West', 'North Seme', 'Seme Central'] },
      { name: 'Nyakach', wards: ['Central Karachuonyo', 'Kajulu', 'Kobura', 'Komingoy', 'Kwangamor', 'North Nyakach', 'South West Nyakach'] },
      { name: 'Seme', wards: ['East Seme', 'Kanungu', 'Katho', 'Koguta', 'North Seme', 'Seme Central', 'West Seme'] },
    ],
  },
  {
    name: 'Kitui',
    capital: 'Kitui',
    subcounties: [
      { name: 'Kitui Central', wards: ['Athi', 'Kisasi', 'Kitui Central', 'Kitui West', 'Mulango'] },
      { name: 'Kitui East', wards: ['Chuluni', 'Kiomo', 'Kyethuni', 'Migwani', 'Mulango', 'Nzambani'] },
      { name: 'Kitui North', wards: ['Ikutha', 'Kanthuni', 'Mutyangome', 'Nzambani', 'Tau'] },
      { name: 'Kitui South', wards: ['Ikutha', 'Kaningo', 'Kisasi', 'Mumoni', 'Tseikuru'] },
      { name: 'Kitui West', wards: ['Ikiany', 'Kisio', 'Kyonza', 'Mauta', 'Mulango', 'Mutomo'] },
      { name: 'Mwingi Central', wards: ['Gongoni', 'Kabati', 'Kamba', 'Kiomo', 'Kivani', 'Migwani', 'Mulango'] },
      { name: 'Mwingi North', wards: ['Gongoni', 'Ikutha', 'Kamba', 'Kiomo', 'Mumoni', 'Tseikuru'] },
      { name: 'Mwingi West', wards: ['Gongoni', 'Kabati', 'Kamba', 'Kiomo', 'Kivani', 'Migwani'] },
    ],
  },
  {
    name: 'Kwale',
    capital: 'Kwale',
    subcounties: [
      { name: 'Kwale Central', wards: ['Ghonzoni', 'Kongani', 'Kwale', 'Mukawawa', 'Shireni'] },
      { name: 'Kwale North', wards: ['Boister', 'Kinango', 'Kisimani', 'Mackinnon Road', 'Mwavumbo'] },
      { name: 'Kwale South', wards: ['Ghubbay', 'Kubo South', 'Puma', 'Shimba Hills'] },
      { name: 'Msambweni', wards: ['Gombatobora', 'Kasemeni', 'Kubo', 'Msambweni', 'Nanighi'] },
      { name: 'Kinango', wards: ['Boister', 'Kasemeni', 'Kinango', 'Mackinnon Road', 'Mwavumbo', 'Ndavaya'] },
    ],
  },
  {
    name: 'Laikipia',
    capital: 'Rumuruti',
    subcounties: [
      { name: 'Laikipia Central', wards: ['Central', 'Daiga', 'Jamu', 'Kanyeni', 'Liki', 'Ngobit'] },
      { name: 'Laikipia East', wards: ['Githiga', 'Igwamiti', 'Kareri', 'Marmanet', 'Ngobit', 'Thego'] },
      { name: 'Laikipia North', wards: ['Doldol', 'Ilmotiok', 'Loldaiga', 'Mumonyot', 'Nyahururu', 'Sosian'] },
      { name: 'Laikipia West', wards: ['Aliya', 'Githiru', 'Kirenga', 'Lemapar', 'Mara', 'Muthengera', 'Nembure'] },
      { name: 'Nyahururu', wards: ['Family Bank', 'Kenyatta Road', 'Nyahururu', 'Ol Kalou', 'Rhino Park'] },
      { name: 'Ol Kalou', wards: ['Central', 'Githiga', 'Kanyenyee', 'Kiamathaga', 'Kirima', 'Mutunguru', 'Nyandarua'] },
    ],
  },
  {
    name: 'Lamu',
    capital: 'Lamu',
    subcounties: [
      { name: 'Lamu Central', wards: ['Hindi', 'Hongwe', 'Kililana', 'Mkunumbi', 'Pate', 'Simambaya'] },
      { name: 'Lamu East', wards: ['Faza', 'Kizingitini', 'Mtangawanda', 'Pate', 'Witu'] },
      { name: 'Lamu West', wards: ['Chenda Chenda', 'Hindi', 'Hongwe', 'Kililana', 'Mkunumbi', 'Mpeketoni', 'Witu'] },
    ],
  },
  {
    name: 'Machakos',
    capital: 'Machakos',
    subcounties: [
      { name: 'Athi River', wards: ['Athi River', 'Kitengela', 'Kuneka', 'Mavoko', 'Syokimau'] },
      { name: 'Kathiani', wards: ['Ikombe', 'Kathiani', 'Mwala', 'Wamunyu'] },
      { name: 'Machakos Central', wards: ['Kalama', 'Kamburu', 'Kangundo', 'Kathiani', 'Machakos', 'Mumbuni North'] },
      { name: 'Machakos Town', wards: ['Athi River', 'Kalama', 'Kamburu', 'Machakos', 'Mumbuni', 'Mitaboni'] },
      { name: 'Masinga', wards: ['Kalamba', 'Kamuthi', 'Kivaa', 'Masinga', 'Thwake'] },
      { name: 'Mwala', wards: ['Kabati', 'Kanisoi', 'Kathiani', 'Mwala', 'Wamunyu'] },
      { name: 'Yatta', wards: ['Ikombe', 'Katangi', 'Kilimambogo', 'Kithimani', 'Makutano', 'Sagamian'] },
    ],
  },
  {
    name: 'Makueni',
    capital: 'Wote',
    subcounties: [
      { name: 'Kaiti', wards: ['Emali', 'Kimaeti', 'Kithungo', 'Ukia', 'Wote'] },
      { name: 'Kibwezi East', wards: ['Chimbanio', 'Embuya', 'Kibwezi', 'Makueni', 'Mtito Andei'] },
      { name: 'Kibwezi West', wards: ['Chyulu', 'Kibwezi', 'Kikumini', 'Makindu', 'Mikoko'] },
      { name: 'Kilome', advancing: ['Kibwezi', 'Makueni', 'Mtito Andei', 'Ukamba'] },
      { name: 'Kilome', wards: ['Kibwezi', 'Kilome', 'Kikima', 'Makueni', 'Tawa'] },
      { name: 'Makueni', wards: ['Kako', 'Keburu', 'Kikoko', 'Kilungu', 'Makueni', 'Wote'] },
      { name: 'Makueni Central', wards: ['Kako', 'Keve', 'Kikima', 'Kikumbi', 'Kilungu', 'Wote'] },
      { name: 'Makueni North', wards: ['Kako', 'Keve', 'Kikima', 'Kikumbi', 'Kilungu'] },
      { name: 'Makueni South', wards: ['Emali', 'Kimaeti', 'Kithungo', 'Mbooni', 'Ukia'] },
      { name: 'Makueni West', wards: ['Emali', 'Mbooni', 'Nzaui', 'Ukia', 'Wote'] },
      { name: 'Mbooni', wards: ['Kikima', 'Kikumbi', 'Kisau', 'Kithungo', 'Mbooni', 'Thui'] },
    ],
  },
  {
    name: 'Mandera',
    capital: 'Mandera',
    subcounties: [
      { name: 'Mandera Central', wards: ['Arabia', 'Bulla Mpya', 'Daran', 'Elwak', 'Mandera', 'Shimbir Fatuma'] },
      { name: 'Mandera East', wards: ['Dandu', 'Fino', 'Libehia', 'Mandera', 'Sera'] },
      { name: 'Mandera North', wards: ['Dandu', 'Derkhale', 'Gore', 'Lafey', 'Malkadimka', 'Ramu'] },
      { name: 'Mandera South', wards: ['Elwak', 'Guba', 'Khalalio', 'Rhamu', 'Takaba'] },
      { name: 'Mandera West', wards: ['Banissa', 'Derkhale', 'Gubis', 'Lafey', 'Rhamu'] },
      { name: 'Lafey', wards: ['Dandu', 'Fino', 'Libehia', 'Lafey', 'Sera'] },
    ],
  },
  {
    name: 'Marsabit',
    capital: 'Marsabit',
    subcounties: [
      { name: 'Marsabit Central', wards: ['Antuambiu', 'Bulla Mpya', 'Jirime', 'Karsa', 'Marsabit', 'Sagante/Jarre'] },
      { name: 'Marsabit North', wards: ['Butiye', 'Dukana', 'Godoma', 'Hannabicha', 'Illeret', 'Laisamis', 'Loiyangalani'] },
      { name: 'Marsabit South', wards: ['Chachabote', 'Gafarsa', 'Goro Rukesa', 'Kargi', 'Kurkuma', 'Laisamis', 'Marsabit'] },
      { name: 'Moyale', wards: ['Girissa', 'Golbo', 'Guba', 'Moyale', 'Sagalo', 'Sorri'] },
      { name: 'North Horr', wards: ['Dukana', 'Gallabesa', 'Maikona', 'Marsabit', 'North Horr', 'Turbi'] },
      { name: 'Saku', wards: ['Antuambiu', 'Jirime', 'Karsa', 'Sagante', 'Waso'] },
    ],
  },
  {
    name: 'Meru',
    capital: 'Meru',
    subcounties: [
      { name: 'Buuri', wards: ['Buuri Central', 'Kibirichia', 'Kiguchwa', 'Miathene', 'Rojo', 'Tigania'] },
      { name: 'Central Imenti', wards: ['Abothuguchi Central', 'Abothuguchi West', 'Kiagu', 'Kibirichia', 'Mitunguu', 'Mwiteria'] },
      { name: 'East Imenti', wards: ['Akirang\'ondu', 'Athiru Ruujine', 'Igambang\'ombe', 'Kiene', 'Kiunga', 'Mikinduri', 'Thangatha'] },
      { name: 'Igembe Central', wards: ['Akirang\'ondu', 'Athiru Ruujine', 'Igembe South', 'Igoji', 'Kangeta', 'Kilimani', 'Mikinduri'] },
      { name: 'Igembe North', wards: ['Antuambui', 'Kangeta', 'Kiegoi', 'Ndoleli', 'Ngambela', 'Thangatha'] },
      { name: 'Igembe South', wards: ['Igembe', 'Igoji', 'Kangeta', 'Kilimani', 'Mikinduri', 'Muthara', 'Thangatha'] },
      { name: 'Imenti North', wards: ['Abothuguchi Central', 'Abothuguchi East', 'Abothuguchi West', 'Katheri', 'Kiagu', 'Miathene', 'Rojo'] },
      { name: 'Imenti South', wards: ['Abomakini', 'Aiboma', 'Akinu', 'Kiangai', 'Kiegoi', 'Kithirune', 'Muthara', 'Njia'] },
      { name: 'Tigania East', wards: ['Akirang\'ondu', 'Athiru Ruujine', 'Igembe South', 'Igoji', 'Kiene', 'Mikinduri'] },
      { name: 'Tigania West', wards: ['Kanthi', 'Kiegoi', 'Kilimani', 'Korongoro', 'Miathene', 'Mikinduri', 'Ngambela'] },
    ],
  },
  {
    name: 'Migori',
    capital: 'Migori',
    subcounties: [
      { name: 'Migori', wards: ['Kendu Bay', 'Kuria Central', 'Migori', 'North Sakwa', 'Suna', 'West Sakwa'] },
      { name: 'Nyatike', wards: ['Kanyasubwa', 'Kebharigga', 'Kendu Bay', 'Migori', 'Nyatike', 'Suna'] },
      { name: 'Rongo', wards: ['Kadongo', 'Kehancha', 'Kitayama', 'Komotobo', 'Migori', 'Ndhiwa', 'Rongo', 'Wanga'] },
      { name: 'Suna East', wards: ['Gokeharaka', 'Got Kowidi', 'Kehancha', 'Kigongo', 'Kuria Central', 'Meshamani', 'Suna'] },
      { name: 'Suna West', wards: ['Kehancha', 'Kuria Central', 'Nyabikomu', 'Nyandago', 'Suna', 'Wasio'] },
      { name: 'Uriri', wards: ['Kajwang', 'Kamagambo', 'Kanyadhiang', 'Kendu Bay', 'Kogembo', 'Ulbule', 'Uriri'] },
    ],
  },
  {
    name: 'Mombasa',
    capital: 'Mombasa',
    subcounties: [
      { name: 'Changamwe', wards: ['Changamwe', 'Chaani', 'Kongowea', 'Majengo', 'Mwembe/Tanga'] },
      { name: 'Jomvu', wards: ['Jomvu', 'Kizingo', 'Migadini', 'Mikindani', 'Miritini'] },
      { name: 'Kilindini', wards: ['Dzirabla', 'Fukayoni', 'Kilindini', 'Mramani', 'Shirikisha'] },
      { name: 'Kisauni', wards: ['Bamburi', 'Freretown', 'Jomvu', 'Kisauni', 'Mwakirunge', 'Mtopanga'] },
      { name: 'Likoni', wards: ['Frimini', 'Likoni', 'Shika Adabu', 'Timbwani', ' Mtongwe'] },
      { name: 'Mvita', wards: ['Anjiru', 'Changamwe', 'Ghana', 'Kilindini', 'Majengo', 'Mji wa Kale', 'Mvita', 'Shirikisha'] },
    ],
  },
  {
    name: "Murang'a",
    capital: "Murang'a",
    subcounties: [
      { name: "Kangema", wards: ['Ihrathi', 'Kangema', 'Kanyenya-ini', 'Mathioya', 'Muguru', 'Rwathia'] },
      { name: "Kigumo", wards: ['Kahuti', 'Kangari', 'Kibichua', 'Kigumo', 'Kirere', "Murang'a", 'Ng\'obia'] },
      { name: "Kiharu", wards: ['Daragati', 'Embue', "Kahuro", 'Muguru', "Murang'a", 'Nginduri', 'Ragati'] },
      { name: "Mathioya", wards: ['Kamacharia', 'Kiangai', 'Kiriaini', 'Kiria', 'Mathioya', "Murang'a"] },
      { name: "Mt. Kenya", wards: ['Kimathi', 'Kirere', 'Mukurwe', 'Mutunguru', 'Thangathi'] },
      { name: "Murang'a South", wards: ['Ihura', 'Kahuro', 'Kiria', 'Murang\'a', 'Nginduri', 'Njoroge', 'Ragati'] },
      { name: "Sub-County Kangema", wards: ['Ihrathi', 'Kangema', 'Kanyenya-ini', 'Mathioya', 'Muguru', 'Rwathia'] },
    ],
  },
  {
    name: 'Nairobi',
    capital: 'Nairobi',
    subcounties: [
      { name: 'Dagoretti North', wards: ['Dagoretti', 'Kabiro', 'Kawangware', 'Kenyatta', 'Mutuini', 'Ngiini', 'Riruta', 'Uthiru', 'Waithaka'] },
      { name: 'Dagoretti South', wards: ['Kilimani', 'Kenyatta', 'Langata', 'Mugongo', 'Riruta', 'Uthiru'] },
      { name: 'Embakasi Central', wards: ['Airport', 'Belle Vue', 'Dandora', 'Eastleigh', 'Gilgil', 'Kariobangi', 'Kasarani', 'Mihang\'o', 'Njiru', 'Pipeline', 'Runyejes'] },
      { name: 'Embakasi East', wards: ['Athi River', 'Aviation', 'Dandora', 'Embolasava', 'Kariobangi', 'Mowlem', 'Njiru', 'Pipeline'] },
      { name: 'Embakasi North', wards: ['Dandora', 'Dhoroto', 'Kariobangi', 'Kayole', 'Kasarani', 'Njiru', 'Ruaraka'] },
      { name: 'Embakasi South', wards: ['Embulbul', 'Imara Daima', 'Kwa Njenga', 'Kwa Reuben', 'Mukuru Kwa Njenga', 'Pipeline', 'Soweto East'] },
      { name: 'Embakasi West', wards: ['Califonia', 'Kasarani', 'Kwa Njenga', 'Kwa Reuben', 'Mihang\'o', 'Mukuru Kwa Njenga', 'Utawala'] },
      { name: 'Kamukunji', wards: ['California', 'Eastleigh', 'Giithuru', 'Kamukunji', 'Majengo', 'Mlango Kubwa', 'Mowlem', 'Old Eastleigh', 'Pumwani'] },
      { name: 'Kasarani', wards: ['Clay City', 'Githurai', 'Garden City', 'Hypo', 'Kahawa', 'Kasarani', 'Mirema', 'Mwiki', 'Roysambu', 'Thika Road', 'Zimmerman'] },
      { name: 'Kibra', wards: ['Kibera', 'Kianda', 'Makina', 'Mashimoni', 'Makongeni', 'Ngando', 'Sarangombe', 'Soweto East'] },
      { name: 'Lang\'ata', wards: ['Bombers', 'Kenyatta', 'Langata', 'Mugumo', 'Nairobi West', 'Nanga', 'Silanga', 'South C'] },
      { name: 'Mathare', wards: ['Huruma', 'Kiamaiko', 'Kiangai', 'Kijiji', 'Korogocho', 'Mabatini', 'Mathare', 'Mlango Kubwa', 'Mowlem', 'Ngei', 'Plainview'] },
      { name: 'Roysambu', wards: ['Garden City', 'Githurai', 'Kahawa', 'Kahawa Wendani', 'Kasarani', 'Mirema', 'Roysambu', 'Zimmerman'] },
      { name: 'Ruaraka', wards: ['Athi River', 'Baba Dogo', 'Dandora', 'Korogocho', 'Lucky Summer', 'Mathare', 'Mukuru', 'Njiru', 'Ruaraka', 'Utalii'] },
      { name: 'Starehe', wards: ['Joseph Kangethe', 'Kariakoo', 'Nairobi', 'Ngara', 'Pangani', 'Ziwani'] },
      { name: 'Westlands', wards: ['Highfield', 'Kangemi', 'Kilimani', 'Kasarani', 'Lavington', 'Milimani', 'Muthithi', 'Parklands', 'Westlands'] },
    ],
  },
  {
    name: 'Nakuru',
    capital: 'Nakuru',
    subcounties: [
      { name: 'Bahati', wards: ['Baruti', 'Biashara', 'Dundori', 'Kabatini', 'Kiamaina', 'Kenyoya', 'Mariashoni', 'Njoroge'] },
      { name: 'Gilgil', wards: ['Elementaita', 'Gilgil', 'Kamburu', 'Kariobangi', 'Mbaruk', 'Muringato', 'Naivasha', 'Soroi'] },
      { name: 'Kuresoi North', wards: ['Amalo', 'Keringet', 'Kuresoi', 'Lengenet', 'Molo', 'Turi'] },
      { name: 'Kuresoi South', wards: ['E摄影作品taita', 'Eremani', 'Kuresoi', 'Mogoira', 'Molo', 'Sirikwa'] },
      { name: 'Molo', wards: ['Elburgon', 'Eremani', 'Jua Kali', 'Mau Forest', 'Molo', 'Turi'] },
      { name: 'Nakuru Central', wards: ['Biashara', 'Kivumbi', 'Menengai', 'Mji wa Mumwe', 'Nakuru East', 'Nakuru West'] },
      { name: 'Nakuru East', wards: ['BK/Evening', 'Biashara', 'Kivumbi', 'Menengai', 'Mjimwema', 'Subukia'] },
      { name: 'Nakuru North', wards: ['Baruti', 'Dundori', 'Kabatini', 'Kenyoya', 'Kiamaina', 'Rongai', 'Subukia'] },
      { name: 'Nakuru West', wards: ['Kaptembwa', 'Kasyoka', 'Kongoni', 'Lake View', 'Menengai', 'Mwariki', 'Naishi'] },
      { name: 'Naivasha', wards: ['Biashara', 'Karunga', 'Kihoto', 'Mai Mahiu', 'Moi South Lake', 'Naivasha', 'North Lake', 'Ol\'Kalou'] },
      { name: 'Narok North', wards: ['Bisil', 'Kaputiei', 'Keekonyokie', 'Kelvin', 'Molo', 'Narok', 'Olkinyei', 'Sakuda'] },
      { name: 'Rongai', wards: ['Menengai', 'Ndaragwa', 'Njoro', 'Rongai', 'Subukia'] },
      { name: 'Subukia', wards: ['Kabatini', 'Kiamaina', 'Kigambo', 'Lower Subukia', 'Rongai', 'Subukia'] },
    ],
  },
  {
    name: 'Nandi',
    capital: 'Kapsabet',
    subcounties: [
      { name: 'Aldai', wards: ['Kamoiywo', 'Kembu', 'Koilot', 'Kong\'alei', 'Tindiret'] },
      { name: 'Chesumei', wards: ['Chemelil', 'Chepsinendet', 'Kisioi', 'Kuroi', 'Lelmokiro', 'Nandii'] },
      { name: 'Emgwen', wards: ['Chepkunyuk', 'Kabiyet', 'Kaplamai', 'Kapsabet', 'Meteitei', 'Mosop'] },
      { name: 'Mosop', wards: ['Cheptuek', 'Kabiyet', 'Kaplamai', 'Koibe', 'Metetei', 'Mosop', 'Ndoto', 'Tindiret'] },
      { name: 'Nandi Central', wards: ['Chepterwai', 'Kabiyet', 'Kaplamai', 'Kapsabet', 'Kopere', 'Mosop'] },
      { name: 'Nandi East', wards: ['Chepterwai', 'Kabiyet', 'Kobujoi', 'Kondabilet', 'Leitik', 'Mosop'] },
      { name: 'Nandi Hills', wards: ['Chepterwai', 'Kaplamai', 'Kobujoi', 'Nandi Hills', 'Sangalo'] },
      { name: 'Tindiret', wards: ['Kamoiywo', 'Kembu', 'Koilot', 'Kong\'alei', 'Lelmokiro', 'Tindiret'] },
    ],
  },
  {
    name: 'Narok',
    capital: 'Narok',
    subcounties: [
      { name: 'Narok Central', wards: ['Amalo', 'Kerialo', 'Kihoko', 'Kikuro', 'Lenderoi', 'Narok', 'Olkinyei', 'Oloitoktok'] },
      { name: 'Narok East', wards: ['Emarti', 'Ewaso Kedong', 'Nkaretai', 'Naroosura', 'Olpul', 'Ololulung\'a', 'Sagamian'] },
      { name: 'Narok North', wards: ['Arash', 'Kebete', 'Narok', 'Nkoile', 'Olkinyei', 'Olorien', 'Olpul', 'Olmoran'] },
      { name: 'Narok South', wards: ['Koilot', 'Logisho', 'Mogori', 'Nkilet', 'Ololulung\'a', 'Osinon', 'Songetoto'] },
      { name: 'Narok West', wards: ['Emarti', 'Ilmotiok', 'Kilgoris', 'Kisii', 'Mogongo', 'Morijoi', 'Ololulung\'a', 'Sururu'] },
      { name: 'Trans Mara West', wards: ['Kehancha', 'Kenya', 'Kilgoris', 'Kirobi', 'Mogonge', 'Ololulunga'] },
      { name: 'Trans Mara East', wards: ['Kebete', 'Kehancha', 'Konyao', 'Ololulunga', 'Olkinyei'] },
      { name: 'Kilgoris', wards: ['Kehancha', 'Kenya', 'Kilgoris', 'Kirobi', 'Mogonge', 'Morijoi'] },
    ],
  },
  {
    name: 'Nyamira',
    capital: 'Nyamira',
    subcounties: [
      { name: 'Borabu', wards: ['Esanage', 'Kiabonyoru', 'Nyansiongo', 'Nyaramba', 'Omogona'] },
      { name: 'Masaba', wards: ['Bogichoncho', 'Itibo', 'Kiabonyoru', 'Masaba', 'Nyamira', 'Nyasang'] },
      { name: 'Nyamira Central', wards: ['Bogichoncho', 'Itibo', 'Kiabonyoru', 'Nyabikomu', 'Nyamira', 'Nyandaro'] },
      { name: 'Nyamira North', wards: ['Bogichoncho', 'Ekerenyo', 'Itibo', 'Manga', 'Nyamira', 'Nyandaro'] },
      { name: 'Nyamira South', wards: ['Esanage', 'Kiabonyoru', 'Nyansiongo', 'Nyaramba', 'Omogona'] },
    ],
  },
  {
    name: 'Nyandarua',
    capital: 'Ol Kalou',
    subcounties: [
      { name: 'Kinangop', wards: ['Engineer', 'Gathara', 'Kipipiri', 'Mawingu', 'Ndaragwa', 'North Mawingu', 'Ol Kalou', 'Sharpoi'] },
      { name: 'Kipipiri', wards: ['Gathara', 'Kipipiri', 'Ol Joro Orok', 'Wanjohi'] },
      { name: 'Ndaragwa', wards: ['Kipipiri', 'Mawingu', 'Ndaragwa', 'North Mawingu', 'Ol Kalou'] },
      { name: 'Ol Kalou', wards: ['Central', 'Gathara', 'Kipipiri', 'Kuri', 'Mawingu', 'Ol Kalou'] },
      { name: 'Ol Joro Orok', wards: ['Kipipiri', 'Mawingu', 'Ol Joro Orok', 'Ol Kalou', 'Wanjohi'] },
      { name: 'Sub-County Ndaragwa', wards: ['Engineer', 'Gathara', 'Kipipiri', 'Mawingu', 'Ndaragwa', 'North Mawingu', 'Ol Kalou', 'Sharpoi'] },
    ],
  },
  {
    name: 'Nyeri',
    capital: 'Nyeri',
    subcounties: [
      { name: 'Kieni East', wards: ['Gaichanjiru', 'Karumi', 'Kiawara', 'Muhoya', 'Mukurwe', 'Thangathi'] },
      { name: 'Kieni West', wards: ['Chinga', 'Kieni', 'Kihuyo', 'Mathira', 'Mugathani', 'Mukurwe', 'Thanjai'] },
      { name: 'Mathira East', wards: ['Baricho', 'Gathuthi', 'Karatina', 'Konyu', 'Kirimukuyu', 'Mathira', 'Mugoiri'] },
      { name: 'Mathira West', wards: ['Gatunda', 'Konyu', 'Mukurwe-ini', 'Noria', 'Rugira', 'Thangathi'] },
      { name: 'Mukurwe-ini', wards: ['Gikondi', 'Githiria', 'Ihuririo', 'Kiarathimi', 'Kirigiti', 'Mugathani', 'Mukurwe-ini'] },
      { name: 'Nyeri Central', wards: ['Dedan Kimathi', 'Kamakwa', 'Karatina', 'Kieni', 'Kirimukuyu', 'Mathira', 'Rware', 'Thangathi'] },
      { name: 'Nyeri Town', wards: ['Dedan Kimathi', 'Githinji', 'Kamukunji', 'Kiangai', 'Kirimukuyu', 'Rware'] },
      { name: 'Tetu', wards: ['Aberdares', 'Dedan Kimathi', 'Kamuyu', 'Karama', 'Mihuu', 'Wamagana'] },
    ],
  },
  {
    name: 'Samburu',
    capital: 'Maralal',
    subcounties: [
      { name: 'Samburu Central', wards: ['Kisima', 'Lolkunono', 'Maralal', 'Morijo', 'Samburu', 'Sergoit'] },
      { name: 'Samburu East', wards: ['Angata Nanyokie', 'Baragoi', 'Birqot', 'Dodot', 'Ndoto', 'Siany'] },
      { name: 'Samburu North', wards: ['Baragoi', 'Birqot', 'Dodot', 'Laisamis', 'Loiyangalani', 'Nyiro', 'Wamba'] },
      { name: 'Samburu West', wards: ['Kisima', 'Maralal', 'Maringo', 'Piyat', 'Wamba', 'Waso'] },
    ],
  },
  {
    name: 'Siaya',
    capital: 'Siaya',
    subcounties: [
      { name: 'Alego Usonga', wards: ['Alego', 'Boro', ' Karemo', 'Ng\'iya', 'Sidindi', 'Ugunja', 'Yala'] },
      { name: 'Gem', wards: ['Boro', 'East Yimbo', 'Kamagak', 'Kambare', ' Karemo', 'North Ugenya', 'North Seme', ' Ugenya'] },
      { name: 'Ugenya', wards: ['Boro', 'East Yimbo', 'Kamagak', 'Ugenya', 'Wambasa'] },
      { name: 'Ugunja', wards: ['Boro', 'Kambare', 'Karemo', 'Sidindi', 'Ugunja', 'Yala'] },
      { name: 'Bondo', wards: ['Bondo', 'K\'Ogalo', 'Kendu Bay', 'Manyuanda', 'Rangwe', 'Uyoga'] },
      { name: 'Rarieda', wards: ['East Alego', 'Kamelilo', 'Kandaw', 'Karan I', 'Karan II', 'Kobujoi', 'North Alego', ' Ugenya'] },
    ],
  },
  {
    name: 'Taita-Taveta',
    capital: 'Mwatate',
    subcounties: [
      { name: 'Mwatate', wards: ['Bura', 'Mwatate', 'Rukanga', 'Sagala', 'Wundanyi'] },
      { name: 'Taveta', wards: ['Bura', 'Kishushe', 'Mwatate', 'Taveta', 'Wundanyi'] },
      { name: 'Voi', wards: ['Bura', 'Kaloleni', 'Mabokoni', 'Mariakani', 'Mwatate', 'Voi'] },
      { name: 'Wundanyi', wards: ['Bura', 'Mwatate', 'Rukanga', 'Wundanyi'] },
      { name: 'Taita Hills', wards: ['Bura', 'Mwanda', 'Mwatate', 'Rukanga', 'Wundanyi'] },
    ],
  },
  {
    name: 'Tana River',
    capital: 'Hola',
    subcounties: [
      { name: 'Bura', wards: ['Bangale', 'Bura', 'Madogo', 'Nanighi'] },
      { name: 'Garsen', wards: ['Garsen', 'Kipini', 'Mikinduni', 'Ngao', 'Ozi'] },
      { name: 'Hola', wards: ['Bangale', 'Bura', 'Garsen', 'Hola', 'Madogo'] },
    ],
  },
  {
    name: 'Tharaka-Nithi',
    capital: 'Chuka',
    subcounties: [
      { name: 'Chuka', wards: ['Igambang\'ombe', 'Itabundi', 'Kathichi', 'Mwamba', 'Ndagani'] },
      { name: 'Igambang\'ombe', wards: ['Igambang\'ombe', 'Kajuki', 'Karingani', 'Mugumano', 'Ndagani'] },
      { name: 'Maara', wards: ['Gitong\'a', 'Karingani', 'Kibunga', 'Mugumano', 'Nkando', 'Thaara'] },
      { name: 'Muthambi', wards: ['Gakoromone', 'Karingani', 'Kaunga', 'Muthambi', 'Thaara'] },
    ],
  },
  {
    name: 'Trans Nzoia',
    capital: 'Kitale',
    subcounties: [
      { name: 'Kwanza', wards: ['Endebess', 'Kwanza', 'Kinyoro', 'Mategea', 'Sirende', 'Walessa'] },
      { name: 'Saboti', wards: ['Buyofu', 'Chemasingi', 'Kismat', 'Kweyo', 'Milima', 'Motosiet', 'Saboti'] },
      { name: 'Endebess', wards: ['Endebess', 'Endebess South', 'Mategea', 'Nzoia', 'Sirende'] },
      { name: 'Kiminini', wards: ['Bikeke', 'Chwele', 'Kiminini', 'Kitale', 'Kwanza', 'Machakio', 'Matisi', 'Sirende'] },
    ],
  },
  {
    name: 'Turkana',
    capital: 'Lodwar',
    subcounties: [
      { name: 'Turkana Central', wards: ['Kakuma', 'Kanamkemer', 'Kaputiei', 'Lodwar', 'Turkwel'] },
      { name: 'Turkana East', wards: ['Kodich', 'Lokori', 'Lokichoggio', 'Turkwel', 'Kanamkemer'] },
      { name: 'Turkana North', wards: ['Kalobeyei', 'Kakuma', 'Kanamkemer', 'Lokichoggio', 'Lokwamok'] },
      { name: 'Turkana South', wards: ['Katilu', 'Kerio Delta', 'Kibish', 'Koten', 'Turkwel'] },
      { name: 'Turkana West', wards: ['Kakuma', 'Kalobeyei', 'Kanamkemer', 'Kaputiei', 'Lokichoggio', 'Turkwel'] },
      { name: 'Turkana East', wards: ['Kodich', 'Lokichoggio', 'Lokori', 'Turkwel'] },
    ],
  },
  {
    name: 'Uasin Gishu',
    capital: 'Eldoret',
    subcounties: [
      { name: 'Ainabkoi', wards: ['Ainabkoi', 'Kaptembwa', 'Kessess', 'Ngeria', 'Tarakwa'] },
      { name: 'Kapseret', wards: ['Central', 'Kapseret', 'Kipkenyo', 'Kuinet', 'Kunet', 'Langas', 'Mutei', 'Soy', 'Ziwa'] },
      { name: 'Kesses', wards: ['Kesses', 'Koisagat', 'Lelwak', 'Mazeras', 'Ngeria', 'Simat/Kapseret', 'Tarakwa'] },
      { name: 'Moiben', wards: ['Karuna', 'Kipsinjande', 'Koimbe', 'Koitebes', 'Moiben', 'Tabora', 'Turbo'] },
      { name: 'Soy', wards: ['Kabirer', 'Kamukuny', 'Kaplelartet', 'Kaplamai', 'Kesses', 'Moiben', 'Soy', 'Turon'] },
      { name: 'Turbo', wards: ['Huruma', 'Kamukuny', 'Kaplamai', 'Kesses', 'Kipkaron', 'Koimateb', 'Moiben', 'Turon'] },
    ],
  },
  {
    name: 'Vihiga',
    capital: 'Mbale',
    subcounties: [
      { name: 'Emuhaya', wards: ['Central Bunyore', 'East Bunyore', 'Emuhaya', 'Northern Bunyore', 'West Bunyore'] },
      { name: 'Hamisi', wards: ['Bumboga', 'Gisambai', 'Graham', 'Hamisi', 'Lugaga', 'Muhudu', 'Shaviyani', 'Tambua'] },
      { name: 'Sabatia', wards: ['Chavanga', 'Chumuli', 'Kidundu', 'Kolongolo', 'Mudavadi', 'Muhudu', 'Sabatia', 'Shavira'] },
      { name: 'Vihiga', wards: ['Buhuyi', 'Bukemba', 'Busali', 'Chavanga', 'Emuhaya', 'Lyaduywa', 'Muhudu', 'North Maragoli', 'South Maragoli'] },
      { name: 'Luanda', wards: ['Buhuyi', 'Luanda', 'Luanda South', 'Mudavadi', 'North Maragoli', 'South Maragoli'] },
    ],
  },
  {
    name: 'Wajir',
    capital: 'Wajir',
    subcounties: [
      { name: 'Wajir Central', wards: ['Barwago', 'Etherile', 'Ganyure', 'Hagadera', 'Wajir'] },
      { name: 'Wajir East', wards: ['Barwago', 'Bute', 'Hagadera', 'Korondile', 'Wajir'] },
      { name: 'Wajir North', wards: ['Barwago', 'Bute', 'Gurar', 'Habaswein', 'Korondile', 'Tarbaj'] },
      { name: 'Wajir South', wards: ['Ganyure', 'Griftu', 'Kerio', 'Lagboghol', 'Wajir', 'Wagberi'] },
      { name: 'Wajir West', wards: ['Gurar', 'Habaswein', 'Kerio', 'Tarbaj', 'Wagberi'] },
      { name: 'Habaswein', wards: ['Barwago', 'Bute', 'Gurar', 'Habaswein', 'Korondile', 'Tarbaj'] },
    ],
  },
  {
    name: 'West Pokot',
    capital: 'Kapenguria',
    subcounties: [
      { name: 'Kapenguria', wards: ['Kacheliba', 'Kapenguria', 'Kongelai', 'Makutano', 'Paiyon', 'Tartar'] },
      { name: 'K�认识north', wards: ['Kacheliba', 'Kongelai', 'Makutano', 'Sigor'] },
      { name: 'Sigor', wards: ['Kacheliba', 'Kongelai', 'Makutano', 'Paiyon', 'Sigor'] },
      { name: 'West Pokot Central', wards: ['Kapenguria', 'Makutano', 'Paiyon', 'Tartar'] },
      { name: 'Kacheliba', wards: ['Kacheliba', 'Kongelai', 'Makutano', 'Paiyon', 'Tartar'] },
      { name: 'Pokot South', wards: ['Chepareria', 'Kacheliba', 'Kongelai', 'Sigor'] },
    ],
  },
];

// Quick lookup map
export const COUNTY_MAP = new Map<string, CountyData>(
  KENYA_COUNTY_DATA.map(c => [c.name.toLowerCase(), c])
);

// Get subcounties for a county
export function getSubcounties(countyName: string): string[] {
  const county = COUNTY_MAP.get(countyName.toLowerCase());
  return county ? county.subcounties.map(s => s.name) : [];
}

// Get all towns/subcounties flat for a county
export function getLocationsForCounty(countyName: string): string[] {
  const county = COUNTY_MAP.get(countyName.toLowerCase());
  if (!county) return [];
  const locations: string[] = [county.capital];
  county.subcounties.forEach(s => {
    locations.push(s.name);
    if (s.wards) locations.push(...s.wards);
  });
  return [...new Set(locations)];
}

// Flatten all subcounty names across Kenya
export function getAllSubcounties(): string[] {
  const all: string[] = [];
  KENYA_COUNTY_DATA.forEach(c => c.subcounties.forEach(s => all.push(s.name)));
  return [...new Set(all)];
}
