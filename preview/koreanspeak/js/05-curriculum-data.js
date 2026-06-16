// Seeded PRNG (mulberry32) — keeps curriculum stable across page loads
function _mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const CURRICULUM = {
  metadata: {
    title: "KoreanSpeak 90-Day Mastery",
    version: "1.0",
    totalDays: 84,
    totalPhrases: 487,
    targetLevel: "Conversational A2-B1"
  },

  weeks: [],
  phraseIndex: new Map(),

  _rng: null,

  init() {
    if (this.weeks.length > 0) return this;
    // Fixed seed keeps the generated curriculum identical across sessions
    this._rng = _mulberry32(0x4B4F5245);

    this.weeks = [
      // WEEK 1: Sound Foundations
      this.createWeek(1, "Sound Foundations", "Training your ear to Korean sounds", "Listening-only. Focus on sound discrimination.", [
        this.createDay(1, "Korean Sound Inventory", "listening_only", 10, [
          { id: "p001", korean: "안녕하세요", romanization: "annyeonghaseyo", english: "Hello", category: "greeting", difficulty: 1, context: "Universal greeting, any time of day" },
          { id: "p002", korean: "감사합니다", romanization: "gamsahamnida", english: "Thank you", category: "courtesy", difficulty: 1, context: "Formal thank you" },
          { id: "p003", korean: "네", romanization: "ne", english: "Yes", category: "response", difficulty: 1, context: "Formal yes" },
          { id: "p004", korean: "아니요", romanization: "aniyo", english: "No", category: "response", difficulty: 1, context: "Formal no" },
          { id: "p005", korean: "실례합니다", romanization: "sillyehamnida", english: "Excuse me", category: "courtesy", difficulty: 2, context: "Getting attention or apologizing" },
          { id: "p006", korean: "죄송합니다", romanization: "joesonghamnida", english: "I'm sorry", category: "courtesy", difficulty: 2, context: "Formal apology" }
        ]),
        this.createDay(2, "Numbers 1-10", "listening_speaking", 12, [
          { id: "p007", korean: "하나", romanization: "hana", english: "One", category: "number", difficulty: 1 },
          { id: "p008", korean: "둘", romanization: "dool", english: "Two", category: "number", difficulty: 1 },
          { id: "p009", korean: "셋", romanization: "set", english: "Three", category: "number", difficulty: 1 },
          { id: "p010", korean: "넷", romanization: "net", english: "Four", category: "number", difficulty: 1 },
          { id: "p011", korean: "다섯", romanization: "daseot", english: "Five", category: "number", difficulty: 2 },
          { id: "p012", korean: "여섯", romanization: "yeoseot", english: "Six", category: "number", difficulty: 2 },
          { id: "p013", korean: "일곱", romanization: "ilgop", english: "Seven", category: "number", difficulty: 2 },
          { id: "p014", korean: "여덟", romanization: "yeodeol", english: "Eight", category: "number", difficulty: 2 },
          { id: "p015", korean: "아홉", romanization: "ahop", english: "Nine", category: "number", difficulty: 2 },
          { id: "p016", korean: "열", romanization: "yeol", english: "Ten", category: "number", difficulty: 2 }
        ]),
        this.createDay(3, "Korean Vowels Practice", "listening_only", 10, [
          { id: "p017", korean: "아", romanization: "a", english: "Ah", category: "response", difficulty: 1 },
          { id: "p018", korean: "오", romanization: "o", english: "Oh", category: "response", difficulty: 1 },
          { id: "p019", korean: "우", romanization: "u", english: "Ooh", category: "response", difficulty: 1 },
          { id: "p020", korean: "이", romanization: "i", english: "Ee", category: "response", difficulty: 1 },
          { id: "p021", korean: "으", romanization: "eu", english: "Eu", category: "response", difficulty: 2 },
          { id: "p022", korean: "어", romanization: "eo", english: "Uh", category: "response", difficulty: 2 }
        ]),
        this.createDay(4, "Basic Particles", "listening_speaking", 12, [
          { id: "p023", korean: "입니다", romanization: "imnida", english: "Is / Am / Are (formal)", category: "phrase", difficulty: 2 },
          { id: "p024", korean: "주세요", romanization: "juseyo", english: "Please give me", category: "courtesy", difficulty: 2 },
          { id: "p025", korean: "있어요", romanization: "isseoyo", english: "There is / I have", category: "phrase", difficulty: 2 },
          { id: "p026", korean: "없어요", romanization: "eopseoyo", english: "There isn't / I don't have", category: "phrase", difficulty: 2 },
          { id: "p027", korean: "좋아요", romanization: "joayo", english: "It's good / I like it", category: "emotion", difficulty: 2 }
        ]),
        this.createDay(5, "Numbers 11-20", "listening_speaking", 12, [
          { id: "p028", korean: "열하나", romanization: "yeolhana", english: "Eleven", category: "number", difficulty: 2 },
          { id: "p029", korean: "열둘", romanization: "yeoldool", english: "Twelve", category: "number", difficulty: 2 },
          { id: "p030", korean: "열셋", romanization: "yeolset", english: "Thirteen", category: "number", difficulty: 2 },
          { id: "p031", korean: "열넷", romanization: "yeolnet", english: "Fourteen", category: "number", difficulty: 2 },
          { id: "p032", korean: "열다섯", romanization: "yeoldaseot", english: "Fifteen", category: "number", difficulty: 2 },
          { id: "p033", korean: "스물", romanization: "seumul", english: "Twenty", category: "number", difficulty: 3 }
        ]),
        this.createDay(6, "Korean Consonants", "listening_only", 10, [
          { id: "p034", korean: "가", romanization: "ga", english: "Ga", category: "response", difficulty: 1 },
          { id: "p035", korean: "나", romanization: "na", english: "Na", category: "response", difficulty: 1 },
          { id: "p036", korean: "다", romanization: "da", english: "Da", category: "response", difficulty: 1 },
          { id: "p037", korean: "라", romanization: "ra", english: "Ra", category: "response", difficulty: 1 },
          { id: "p038", korean: "마", romanization: "ma", english: "Ma", category: "response", difficulty: 1 },
          { id: "p039", korean: "바", romanization: "ba", english: "Ba", category: "response", difficulty: 1 }
        ]),
        this.createDay(7, "Week 1 Review", "review", 15, [
          { id: "p040", korean: "안녕하세요", romanization: "annyeonghaseyo", english: "Hello", category: "greeting", difficulty: 1 },
          { id: "p041", korean: "감사합니다", romanization: "gamsahamnida", english: "Thank you", category: "courtesy", difficulty: 1 },
          { id: "p042", korean: "하나 둘 셋", romanization: "hana dool set", english: "One two three", category: "number", difficulty: 1 },
          { id: "p043", korean: "실례합니다", romanization: "sillyehamnida", english: "Excuse me", category: "courtesy", difficulty: 2 },
          { id: "p044", korean: "주세요", romanization: "juseyo", english: "Please give me", category: "courtesy", difficulty: 2 },
          { id: "p045", korean: "좋아요", romanization: "joayo", english: "It's good", category: "emotion", difficulty: 2 }
        ])
      ]),

      // WEEK 2: Survival Speaking
      this.createWeek(2, "Survival Speaking", "Essential phrases for daily life", "First spoken responses. Simple answers.", [
        this.createDay(8, "Greetings & Farewells", "speaking", 15, [
          { id: "p046", korean: "안녕하세요", romanization: "annyeonghaseyo", english: "Hello (formal)", category: "greeting", difficulty: 1 },
          { id: "p047", korean: "안녕히 가세요", romanization: "annyeonghi gaseyo", english: "Goodbye (to someone leaving)", category: "greeting", difficulty: 2 },
          { id: "p048", korean: "안녕히 계세요", romanization: "annyeonghi gyeseyo", english: "Goodbye (to someone staying)", category: "greeting", difficulty: 2 },
          { id: "p049", korean: "좋은 아침이에요", romanization: "joeun achimieyo", english: "Good morning", category: "greeting", difficulty: 2 },
          { id: "p050", korean: "안녕히 주무세요", romanization: "annyeonghi jumuseyo", english: "Good night (formal)", category: "greeting", difficulty: 2 },
          { id: "p051", korean: "또 봐요", romanization: "tto bwayo", english: "See you again", category: "greeting", difficulty: 1 }
        ]),
        this.createDay(9, "Polite Expressions", "speaking", 12, [
          { id: "p052", korean: "감사합니다", romanization: "gamsahamnida", english: "Thank you (formal)", category: "courtesy", difficulty: 1 },
          { id: "p053", korean: "고마워요", romanization: "gomawoyo", english: "Thanks (casual)", category: "courtesy", difficulty: 1 },
          { id: "p054", korean: "천만에요", romanization: "cheonmaneyo", english: "You're welcome", category: "courtesy", difficulty: 2 },
          { id: "p055", korean: "죄송합니다", romanization: "joesonghamnida", english: "I'm sorry (formal)", category: "courtesy", difficulty: 2 },
          { id: "p056", korean: "괜찮아요", romanization: "gwaenchanayo", english: "It's okay", category: "response", difficulty: 2 },
          { id: "p057", korean: "축하해요", romanization: "chukahaeyo", english: "Congratulations", category: "courtesy", difficulty: 2 }
        ]),
        this.createDay(10, "Self Introduction", "speaking", 15, [
          { id: "p058", korean: "저는 ... 이에요", romanization: "jeoneun ... ieyo", english: "I am ...", category: "phrase", difficulty: 2 },
          { id: "p059", korean: "이름이 뭐예요?", romanization: "ireumi mwoyeyo?", english: "What's your name?", category: "question", difficulty: 2 },
          { id: "p060", korean: "반가워요", romanization: "bangawoyo", english: "Nice to meet you", category: "greeting", difficulty: 2 },
          { id: "p061", korean: "저는 미국 사람이에요", romanization: "jeoneun miguk saramieyo", english: "I'm American", category: "phrase", difficulty: 3 },
          { id: "p062", korean: "한국어를 배우고 있어요", romanization: "hangugeoreul baeugo isseoyo", english: "I'm learning Korean", category: "phrase", difficulty: 3 }
        ]),
        this.createDay(11, "Ordering Food", "speaking", 15, [
          { id: "p063", korean: "주문할게요", romanization: "jumunhalgeyo", english: "I'd like to order", category: "food", difficulty: 2 },
          { id: "p064", korean: "이거 주세요", romanization: "igeo juseyo", english: "This one, please", category: "food", difficulty: 2 },
          { id: "p065", korean: "맛있어요", romanization: "massissoyo", english: "It's delicious", category: "food", difficulty: 2 },
          { id: "p066", korean: "물 주세요", romanization: "mul juseyo", english: "Water, please", category: "drink", difficulty: 1 },
          { id: "p067", korean: "계산해 주세요", romanization: "gyesanhae juseyo", english: "Check, please", category: "food", difficulty: 2 }
        ]),
        this.createDay(12, "Asking Directions", "speaking", 15, [
          { id: "p068", korean: "화장실 어디예요?", romanization: "hwajangsil eodiyeyo?", english: "Where is the bathroom?", category: "direction", difficulty: 2 },
          { id: "p069", korean: "여기 어디예요?", romanization: "yeogi eodiyeyo?", english: "Where is this place?", category: "direction", difficulty: 2 },
          { id: "p070", korean: "왼쪽", romanization: "oenjjok", english: "Left", category: "direction", difficulty: 2 },
          { id: "p071", korean: "오른쪽", romanization: "oreunjjok", english: "Right", category: "direction", difficulty: 2 },
          { id: "p072", korean: "직진", romanization: "jikjin", english: "Straight ahead", category: "direction", difficulty: 2 },
          { id: "p073", korean: "감사합니다", romanization: "gamsahamnida", english: "Thank you", category: "courtesy", difficulty: 1 }
        ]),
        this.createDay(13, "Shopping Basics", "speaking", 15, [
          { id: "p074", korean: "얼마예요?", romanization: "eolmayeyo?", english: "How much is it?", category: "shopping", difficulty: 2 },
          { id: "p075", korean: "비싸요", romanization: "bissayo", english: "It's expensive", category: "shopping", difficulty: 2 },
          { id: "p076", korean: "싸요", romanization: "ssayo", english: "It's cheap", category: "shopping", difficulty: 2 },
          { id: "p077", korean: "카드 돼요?", romanization: "kadeu dwaeyo?", english: "Do you take card?", category: "shopping", difficulty: 2 },
          { id: "p078", korean: "영수증 주세요", romanization: "yeongsujeung juseyo", english: "Receipt, please", category: "shopping", difficulty: 3 }
        ]),
        this.createDay(14, "Week 2 Review", "review", 15, [
          { id: "p079", korean: "안녕히 가세요", romanization: "annyeonghi gaseyo", english: "Goodbye (to someone leaving)", category: "greeting", difficulty: 2 },
          { id: "p080", korean: "이름이 뭐예요?", romanization: "ireumi mwoyeyo?", english: "What's your name?", category: "question", difficulty: 2 },
          { id: "p081", korean: "이거 주세요", romanization: "igeo juseyo", english: "This one, please", category: "food", difficulty: 2 },
          { id: "p082", korean: "화장실 어디예요?", romanization: "hwajangsil eodiyeyo?", english: "Where is the bathroom?", category: "direction", difficulty: 2 },
          { id: "p083", korean: "얼마예요?", romanization: "eolmayeyo?", english: "How much is it?", category: "shopping", difficulty: 2 },
          { id: "p084", korean: "맛있어요", romanization: "massissoyo", english: "It's delicious", category: "food", difficulty: 2 }
        ])
      ])
    ];

    // Generate weeks 3-12 programmatically with rich content
    const weekThemes = [
      { title: "Food & Dining", theme: "Eating out and food vocabulary", focus: "Restaurant conversations, ordering, tastes" },
      { title: "Daily Routine", theme: "Talking about your day", focus: "Time expressions, daily activities" },
      { title: "Getting Around", theme: "Transportation and travel", focus: "Subway, taxi, bus, directions" },
      { title: "Social Connections", theme: "Making friends and small talk", focus: "Hobbies, weather, casual chat" },
      { title: "Shopping Deep Dive", theme: "Advanced shopping scenarios", focus: "Bargaining, sizes, trying on" },
      { title: "Health & Body", theme: "Talking about health", focus: "Body parts, illness, pharmacy" },
      { title: "Work & Study", theme: "Professional situations", focus: "Office talk, schedules, meetings" },
      { title: "Emotions & Opinions", theme: "Expressing yourself", focus: "Feelings, preferences, debates" },
      { title: "Emergencies", theme: "Handling problems", focus: "Lost items, accidents, help" },
      { title: "Cultural Immersion", theme: "Living like a local", focus: "Slang, fillers, natural speech" }
    ];

    const categories = ['food', 'drink', 'time', 'transport', 'direction', 'weather', 'family', 'emotion', 'shopping', 'body', 'occupation', 'hobby', 'question', 'phrase', 'courtesy', 'greeting', 'response', 'emergency', 'restaurant', 'hotel'];

    weekThemes.forEach((theme, idx) => {
      const weekNum = idx + 3;
      const days = [];
      for (let d = 1; d <= 7; d++) {
        const dayNum = (weekNum - 1) * 7 + d;
        const phrases = [];
        const phraseCount = 5 + Math.floor(this._rng() * 3);
        const dayCategories = this._shuffle([...categories]).slice(0, 3);

        for (let p = 0; p < phraseCount; p++) {
          const cat = dayCategories[p % dayCategories.length];
          phrases.push(this._generatePhrase(weekNum, dayNum, p, cat));
        }

        days.push(this.createDay(dayNum, `Day ${dayNum}: ${this._getDayTitle(weekNum, d)}`, "speaking", 12 + Math.floor(this._rng() * 5), phrases));
      }
      this.weeks.push(this.createWeek(weekNum, theme.title, theme.theme, theme.focus, days));
    });

    this.buildIndex();
    return this;
  },

  createWeek(id, title, theme, focus, days) {
    return { id, title, theme, focus, days };
  },

  createDay(day, title, type, duration, phrases) {
    return {
      id: `w${Math.ceil(day / 7)}d${(day - 1) % 7 + 1}`,
      day,
      title,
      type,
      duration,
      phrases,
      exercises: this._generateExercises(type)
    };
  },

  _generateExercises(type) {
    const allExercises = [
      { type: "pure_listen", description: "Listen 3 times, focus on rhythm and intonation" },
      { type: "listen_repeat", description: "Listen and repeat, shadow the speaker" },
      { type: "speak_solo", description: "Say the phrase without listening first" },
      { type: "speed_challenge", description: "Say all phrases as fast as you can" },
      { type: "scenario_practice", description: "Use the phrase in a real scenario" },
      { type: "sound_discrimination", description: "Hear two similar sounds, identify the difference" },
      { type: "pattern_recognition", description: "Notice the rising tone pattern" },
      { type: "counting_challenge", description: "Count numbers rapidly" },
      { type: "number_recognition", description: "Hear a number, say it back" }
    ];

    if (type === 'listening_only') return [allExercises[0], allExercises[5], allExercises[6]];
    if (type === 'listening_speaking') return [allExercises[0], allExercises[1], allExercises[2]];
    if (type === 'review') return [allExercises[1], allExercises[2], allExercises[3]];
    return [allExercises[1], allExercises[2], allExercises[4]];
  },

  _generatePhrase(week, day, index, category) {
    const phraseBank = this._getPhraseBank(category);
    const base = phraseBank[index % phraseBank.length];
    const id = `p${String((week - 1) * 50 + (day - 1) * 7 + index + 100).padStart(3, '0')}`;
    return { ...base, id, category, difficulty: Math.min(3, 1 + Math.floor((week - 1) / 4)) };
  },

  _getPhraseBank(category) {
    const banks = {
      food: [
        { korean: "김치찌개 주세요", romanization: "gimchijjigae juseyo", english: "Kimchi stew, please" },
        { korean: "불고기 하나 주세요", romanization: "bulgogi hana juseyo", english: "One bulgogi, please" },
        { korean: "맵지 않게 해 주세요", romanization: "maepji anke hae juseyo", english: "Please make it not spicy" },
        { korean: "밥 더 주세요", romanization: "bap deo juseyo", english: "More rice, please" },
        { korean: "정말 맛있어요", romanization: "jeongmal masisseoyo", english: "It's really delicious" },
        { korean: "추천해 주세요", romanization: "chucheonhae juseyo", english: "Please recommend something" }
      ],
      drink: [
        { korean: "커피 주세요", romanization: "keopi juseyo", english: "Coffee, please" },
        { korean: "맥주 한 병 주세요", romanization: "maekju han byeong juseyo", english: "One bottle of beer, please" },
        { korean: "소주 있어요?", romanization: "soju isseoyo?", english: "Do you have soju?" },
        { korean: "차 주세요", romanization: "cha juseyo", english: "Tea, please" },
        { korean: "덜 달게 해 주세요", romanization: "deol dalge hae juseyo", english: "Please make it less sweet" }
      ],
      time: [
        { korean: "지금 몇 시예요?", romanization: "jigeum myeot siyeyo?", english: "What time is it now?" },
        { korean: "오늘", romanization: "oneul", english: "Today" },
        { korean: "내일", romanization: "naeil", english: "Tomorrow" },
        { korean: "어제", romanization: "eoje", english: "Yesterday" },
        { korean: "아침", romanization: "achim", english: "Morning" },
        { korean: "저녁", romanization: "jeonyeok", english: "Evening" }
      ],
      transport: [
        { korean: "지하철역 어디예요?", romanization: "jihacheolyeok eodiyeyo?", english: "Where is the subway station?" },
        { korean: "택시 잡아 주세요", romanization: "taeksi jaba juseyo", english: "Please call a taxi" },
        { korean: "여기 세워 주세요", romanization: "yeogi sewo juseyo", english: "Please stop here" },
        { korean: "버스 얼마예요?", romanization: "beoseu eolmayeyo?", english: "How much is the bus?" },
        { korean: "카드 돼요?", romanization: "kadeu dwaeyo?", english: "Can I use a card?" }
      ],
      direction: [
        { korean: "근처에 있어요", romanization: "geuncheoe isseoyo", english: "It's nearby" },
        { korean: "멀어요", romanization: "meoreoyo", english: "It's far" },
        { korean: "앞에", romanization: "ape", english: "In front" },
        { korean: "뒤에", romanization: "dwie", english: "Behind" },
        { korean: "옆에", romanization: "yeope", english: "Next to" }
      ],
      weather: [
        { korean: "날씨가 좋아요", romanization: "nassiga joayo", english: "The weather is nice" },
        { korean: "더워요", romanization: "deowoyo", english: "It's hot" },
        { korean: "추워요", romanization: "chuowoyo", english: "It's cold" },
        { korean: "비가 와요", romanization: "biga wayo", english: "It's raining" },
        { korean: "눈이 와요", romanization: "nuni wayo", english: "It's snowing" }
      ],
      family: [
        { korean: "가족", romanization: "gajok", english: "Family" },
        { korean: "엄마", romanization: "eomma", english: "Mom" },
        { korean: "아빠", romanization: "appa", english: "Dad" },
        { korean: "친구", romanization: "chingu", english: "Friend" },
        { korean: "동생", romanization: "dongsaeng", english: "Younger sibling" }
      ],
      emotion: [
        { korean: "행복해요", romanization: "haengbokaeyo", english: "I'm happy" },
        { korean: "슬퍼요", romanization: "seulpeoyo", english: "I'm sad" },
        { korean: "피곤해요", romanization: "pigonhaeyo", english: "I'm tired" },
        { korean: "신나요", romanization: "sinnayo", english: "I'm excited" },
        { korean: "배고파요", romanization: "baegopayo", english: "I'm hungry" },
        { korean: "목 말라요", romanization: "mok mallayo", english: "I'm thirsty" }
      ],
      shopping: [
        { korean: "입어봐도 돼요?", romanization: "ibeobwado dwaeyo?", english: "Can I try this on?" },
        { korean: "큰 사이즈 있어요?", romanization: "keun saijeu isseoyo?", english: "Do you have a bigger size?" },
        { korean: "작은 사이즈 있어요?", romanization: "jageun saijeu isseoyo?", english: "Do you have a smaller size?" },
        { korean: "깎아 주세요", romanization: "kkakka juseyo", english: "Please give me a discount" },
        { korean: "교환필도 돼요?", romanization: "gyohwanhaldo dwaeyo?", english: "Can I exchange this?" }
      ],
      body: [
        { korean: "머리", romanization: "meori", english: "Head" },
        { korean: "손", romanization: "son", english: "Hand" },
        { korean: "발", romanization: "bal", english: "Foot" },
        { korean: "배", romanization: "bae", english: "Stomach" },
        { korean: "아파요", romanization: "apayo", english: "It hurts" }
      ],
      occupation: [
        { korean: "학생이에요", romanization: "haksaengieyo", english: "I'm a student" },
        { korean: "회사원이에요", romanization: "hoesawonieyo", english: "I'm an office worker" },
        { korean: "선생님이에요", romanization: "seonsaengnimieyo", english: "I'm a teacher" },
        { korean: "무슨 일 해요?", romanization: "museun il haeyo?", english: "What do you do?" }
      ],
      hobby: [
        { korean: "취미가 뭐예요?", romanization: "chwigga mwoyeyo?", english: "What's your hobby?" },
        { korean: "노래해요", romanization: "noraehaeyo", english: "I sing" },
        { korean: "영화 봐요", romanization: "yeonghwa bwayo", english: "I watch movies" },
        { korean: "운동해요", romanization: "undonghaeyo", english: "I exercise" }
      ],
      question: [
        { korean: "뭐예요?", romanization: "mwoyeyo?", english: "What is it?" },
        { korean: "어디예요?", romanization: "eodiyeyo?", english: "Where is it?" },
        { korean: "언제예요?", romanization: "eonjeyeyo?", english: "When is it?" },
        { korean: "누구예요?", romanization: "nuguyeyo?", english: "Who is it?" },
        { korean: "어때요?", romanization: "eottaeyo?", english: "How is it?" }
      ],
      phrase: [
        { korean: "도와 주세요", romanization: "dowa juseyo", english: "Please help me" },
        { korean: "천천히 말씀해 주세요", romanization: "cheoncheonhi malssumhae juseyo", english: "Please speak slowly" },
        { korean: "다시 한 번 말씀해 주세요", romanization: "dasi han beon malssumhae juseyo", english: "Please say that again" },
        { korean: "이해했어요", romanization: "ihaehaesseoyo", english: "I understand" },
        { korean: "몰라요", romanization: "mollayo", english: "I don't know" }
      ],
      courtesy: [
        { korean: "괜찮습니다", romanization: "gwaenchanseumnida", english: "It's okay (formal)" },
        { korean: "고생하셨습니다", romanization: "gosaenghasyeosseumnida", english: "Good work / You worked hard" },
        { korean: "수고하세요", romanization: "sugohaseyo", english: "Take care / Keep up the good work" },
        { korean: "잠깐만요", romanization: "jamkkanmanyo", english: "Just a moment" }
      ],
      greeting: [
        { korean: "오랜만이에요", romanization: "oraenmanieyo", english: "Long time no see" },
        { korean: "어서 오세요", romanization: "eoseo oseyo", english: "Welcome" },
        { korean: "안녕", romanization: "annyeong", english: "Hi (casual)" }
      ],
      response: [
        { korean: "그래요", romanization: "geuraeyo", english: "I see / Okay" },
        { korean: "정말요?", romanization: "jeongmalyo?", english: "Really?" },
        { korean: "대박", romanization: "daebak", english: "Amazing / Wow (slang)" },
        { korean: "진짜요?", romanization: "jinjjayo?", english: "For real?" }
      ],
      emergency: [
        { korean: "도와 주세요!", romanization: "dowa juseyo!", english: "Help me!" },
        { korean: "경찰 불러 주세요", romanization: "gyeongchal bulleo juseyo", english: "Please call the police" },
        { korean: "병원이 어디예요?", romanization: "byeongwoni eodiyeyo?", english: "Where is the hospital?" },
        { korean: "응급이에요", romanization: "eunggeubieyo", english: "It's an emergency" }
      ],
      restaurant: [
        { korean: "자리 있어요?", romanization: "jari isseoyo?", english: "Do you have a table?" },
        { korean: "예약했어요", romanization: "yeyakaesseoyo", english: "I have a reservation" },
        { korean: "메뉴판 주세요", romanization: "menyupan juseyo", english: "Menu, please" },
        { korean: "여기요!", romanization: "yeogiyo!", english: "Excuse me! (calling waiter)" }
      ],
      hotel: [
        { korean: "체크인 하고 싶어요", romanization: "chekeuin hago sipeoyo", english: "I'd like to check in" },
        { korean: "예약했어요", romanization: "yeyakaesseoyo", english: "I have a reservation" },
        { korean: "방 열쇠 주세요", romanization: "bang yeolsoe juseyo", english: "Room key, please" },
        { korean: "와이파이 비밀번호가 뭐예요?", romanization: "waipai bimilbeonhoga mwoyeyo?", english: "What's the WiFi password?" }
      ]
    };
    return banks[category] || banks.phrase;
  },

  _getDayTitle(week, day) {
    const titles = [
      ['Sound Practice', 'Vocabulary Building', 'Listening Drill', 'Speaking Practice', 'Pattern Review', 'Conversation Prep', 'Weekly Review'],
      ['New Words', 'Grammar Patterns', 'Real Scenarios', 'Speed Practice', 'Cultural Notes', 'Common Phrases', 'Weekly Review']
    ];
    return titles[(week - 3) % 2][(day - 1) % 7];
  },

  _shuffle(array) {
    const rand = this._rng || Math.random;
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  buildIndex() {
    this.phraseIndex.clear();
    this.weeks.forEach(week => {
      week.days.forEach(day => {
        day.phrases.forEach(phrase => {
          this.phraseIndex.set(phrase.id, {
            ...phrase,
            week: week.id,
            day: day.id,
            weekTitle: week.title,
            dayTitle: day.title
          });
        });
      });
    });
  },

  getPhrase(id) {
    if (this.phraseIndex.size === 0) this.buildIndex();
    return this.phraseIndex.get(id);
  },

  getLesson(dayNumber) {
    if (this.weeks.length === 0) this.init();
    let currentDay = 0;
    for (const week of this.weeks) {
      for (const day of week.days) {
        currentDay++;
        if (currentDay === dayNumber) return { ...day, week: week.id, weekTitle: week.title };
      }
    }
    return this.weeks[0]?.days[0] || null;
  },

  getWeek(weekNumber) {
    if (this.weeks.length === 0) this.init();
    return this.weeks[weekNumber - 1] || null;
  },

  getPhrasesByCategory(category) {
    if (this.phraseIndex.size === 0) this.buildIndex();
    return Array.from(this.phraseIndex.values()).filter(p => p.category === category);
  },

  getRandomPhrases(count, maxDifficulty = 5) {
    if (this.phraseIndex.size === 0) this.buildIndex();
    const phrases = Array.from(this.phraseIndex.values())
      .filter(p => p.difficulty <= maxDifficulty);
    return this._shuffle(phrases).slice(0, count);
  },

  getAllWeeks() {
    if (this.weeks.length === 0) this.init();
    return this.weeks;
  },

  getTotalPhraseCount() {
    if (this.weeks.length === 0) this.init();
    return this.phraseIndex.size;
  }
};

export { CURRICULUM };
