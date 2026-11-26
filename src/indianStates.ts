/* ==========================================================
   Which Indian state and region a dish comes from, matched by
   its name. Everyday foods (rice, eggs, paneer, chapati) stay
   in All-India.
   ========================================================== */

export const ZONES = ["All-India", "South", "North", "East", "West", "North-East", "Central"];

// [state, region, dish names separated by |]
const STATES: [string, string, string][] = [
  ["Tamil Nadu", "South", "idli|idly|dosa|dosai|sambar|sambhar|rasam|ven pongal|pongal|chettinad|kuzhambu|kulambu|kothu parotta|kothu|sundal|murukku|adhirasam|kozhukattai|thayir sadam|curd rice|puliyodarai|kuzhi paniyaram|paniyaram|poriyal|kootu|thogayal|thuvaiyal|rava kesari|medu vada|medu vadai|vadai|filter coffee|chicken 65|chukka|appalam|keerai|vatha kuzhambu|mor kuzhambu|uthappam|uttapam|tomato rice|tamarind rice|ambur|dindigul|kanchipuram|upma|semiya"],
  ["Kerala", "South", "appam|puttu|avial|aviyal|olan|erissery|thoran|kadala curry|moilee|molee|meen curry|karimeen|malabar|kerala|parotta|unniyappam|pazham pori|ela ada|pathiri|ishtu|palada|payasam|banana chips|sadya|idiyappam|string hopper|nadan|kappa|tapioca|beef fry|kalan|puli inji|thalassery"],
  ["Karnataka", "South", "bisi bele bath|bisibele|ragi mudde|ragi ball|akki roti|neer dosa|mysore pak|mysore|mangalore|kori rotti|uppittu|kesari bath|khara bath|chitranna|puliyogare|obbattu|holige|maddur vada|benne dosa|set dosa|gojju|saaru|kosambari|chow chow bath|ragi"],
  ["Andhra Pradesh", "South", "pesarattu|gongura|pulihora|gutti vankaya|punugulu|ulava charu|bobbatlu|pootharekulu|andhra|kodi kura|pappu|avakaya|pulusu|dibba rotti"],
  ["Telangana", "South", "hyderabadi|haleem|double ka meetha|qubani ka meetha|mirchi ka salan|sakinalu|sarva pindi|bagara|lukhmi|irani chai|osmania"],
  ["Punjab", "North", "sarson ka saag|sarson da saag|makki di roti|makki ki roti|chole bhature|chole bhatura|bhatura|bhature|amritsari|lassi|rajma chawal|rajma|dal makhani|paneer tikka|tandoori|pinni|aloo paratha|paratha|parantha|kadhi pakora|chana masala|chole|chhole|kulcha|butter chicken|makhani|saag|punjabi"],
  ["Delhi", "North", "chaat|aloo tikki|tikki|daulat ki chaat|dahi bhalla|dahi vada|golgappa|gol gappa|pani puri|chole kulche|nihari|seekh kebab|kebab|kabab"],
  ["Uttar Pradesh", "North", "lucknowi|galouti|tunday|kachori sabzi|bedmi|petha|mathura peda|peda|banarasi|malaiyo|tehri|tehari|awadhi|korma|shahi paneer|shahi|dum aloo|malai kofta|kofta|imarti|rabri"],
  ["Jammu & Kashmir", "North", "rogan josh|yakhni|gushtaba|rista|kahwa|kashmiri|modur pulav|haak|tabak maaz|nadru"],
  ["Himachal Pradesh", "North", "siddu|chha gosht|madra|dham|babru|aktori"],
  ["Uttarakhand", "North", "kafuli|aloo ke gutke|bal mithai|singori|chainsoo|phaanu|jhangora|mandua"],
  ["Haryana", "North", "bajra khichdi|kachri|singri|hara dhania cholia|bajra"],
  ["Rajasthan", "West", "dal baati|baati|churma|gatte|ker sangri|laal maas|lal maas|ghevar|pyaaz kachori|pyaz kachori|mirchi vada|bajra roti|mawa kachori|rajasthani|bikaneri|bhujia"],
  ["Gujarat", "West", "dhokla|khandvi|thepla|undhiyu|fafda|handvo|khakhra|dal dhokli|sev tameta|gujarati|basundi|muthia|patra|ganthiya|gathiya|khaman|dabeli|sev usal|kadhi"],
  ["Maharashtra", "West", "vada pav|misal|pav bhaji|puran poli|sabudana|thalipeeth|bhakri|zunka|modak|kothimbir vadi|sol kadhi|bharli vangi|kolhapuri|pithla|amti|varan|maharashtrian|poha|shrikhand|bombay|mumbai"],
  ["Goa", "West", "goan|vindaloo|xacuti|bebinca|sorpotel|balchao|cafreal"],
  ["West Bengal", "East", "rasgulla|rosogolla|sandesh|mishti doi|macher jhol|shorshe|ilish|hilsa|kosha mangsho|luchi|aloo posto|posto|chingri|cholar dal|kathi roll|phuchka|shukto|chomchom|pantua|ghugni|bengali|begun bhaja|kolkata"],
  ["Odisha", "East", "dalma|pakhala|chhena poda|rasabali|santula|macha besara|chhena jhili|odia"],
  ["Bihar", "East", "litti|chokha|sattu|thekua|dal pitha|champaran|malpua|khaja"],
  ["Jharkhand", "East", "dhuska|rugra|chilka roti"],
  ["Assam", "North-East", "masor tenga|tenga|khar|aloo pitika|pitika|til pitha|pitha|assamese|jolpan"],
  ["Manipur", "North-East", "eromba|chak hao|chakhao|singju|manipuri|kangshoi"],
  ["Meghalaya", "North-East", "jadoh|dohneiiong|tungrymbai|nakham"],
  ["Nagaland", "North-East", "axone|smoked pork|naga"],
  ["Sikkim", "North-East", "momo|thukpa|gundruk|sel roti|phagshapa|sikkimese"],
  ["Tripura", "North-East", "mui borok|chakhwi|berma"],
  ["Mizoram", "North-East", "mizo|vawksa"],
  ["Arunachal Pradesh", "North-East", "apong|pika pila"],
  ["Madhya Pradesh", "Central", "bhutte ka kees|dal bafla|bafla|mawa bati|indori|poha jalebi|chakki ki shaak"],
  ["Chhattisgarh", "Central", "fara|aamat|bafauri|dubki kadhi|chhattisgarhi"],
];

export const statesIn = (zone: string) => STATES.filter(([, z]) => z === zone).map(([s]) => s);

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
type Rule = { kw: string; state: string; zone: string; re: RegExp };
const RULES: Rule[] = STATES.flatMap(([state, zone, words]) =>
  words.split("|").map((kw) => ({ kw, state, zone, re: new RegExp(`(^|[^a-z])${esc(kw)}(?:e?s)?($|[^a-z])`) })),
).sort((a, b) => b.kw.length - a.kw.length); // longest (most specific) name wins

export function placeIndian(text: string): { st: string; zn: string } {
  const t = text.toLowerCase();
  for (const r of RULES) if (t.includes(r.kw) && r.re.test(t)) return { st: r.state, zn: r.zone };
  return { st: "", zn: "All-India" };
}