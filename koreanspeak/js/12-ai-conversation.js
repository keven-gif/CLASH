import { store } from './01-state.js';
import { audioEngine } from './03-audio-engine.js';

class AIConversation {
  constructor() {
    this.history = [];
    this.scenarios = [
      {
        id: 'cafe_ordering',
        title: 'Ordering at a Cafe',
        description: 'Practice ordering coffee and snacks',
        systemPrompt: 'You are a friendly cafe barista in Seoul. The customer is learning Korean. Keep responses short (1-2 sentences). Use simple Korean. If they make mistakes, politely correct them. Never use English unless they ask.',
        openingLines: [
          '어서 오세요. 무엇을 드릴까요?',
          '안녕하세요. 주문하시겠어요?',
          '환영합니다. 커피 주문하실래요?'
        ]
      },
      {
        id: 'directions',
        title: 'Asking for Directions',
        description: 'Get directions to popular places',
        systemPrompt: 'You are a friendly local in Seoul helping a lost tourist. The tourist is learning Korean. Give clear, simple directions in Korean. Use landmarks. Keep responses to 2-3 short sentences.',
        openingLines: [
          '안녕하세요. 어디 찾으세요?',
          '무슨 일이에요? 길을 잃었어요?',
          '도와드릴까요? 어디 가고 싶어요?'
        ]
      },
      {
        id: 'shopping',
        title: 'Shopping Conversation',
        description: 'Bargain and ask about products',
        systemPrompt: 'You are a shopkeeper in Myeongdong. The customer is learning Korean. Be friendly and patient. Keep responses short. Help them with sizes and prices.',
        openingLines: [
          '어서 오세요. 마음에 드는 거 있어요?',
          '안녕하세요. 뭐 찾으세요?',
          '환영합니다. 이 제품 추천해요.'
        ]
      },
      {
        id: 'restaurant',
        title: 'At a Restaurant',
        description: 'Order food and ask about the menu',
        systemPrompt: 'You are a restaurant server in Seoul. The customer is learning Korean. Help them order. Recommend dishes. Keep responses short and simple. Use polite language.',
        openingLines: [
          '어서 오세요. 몇 분이세요?',
          '안녕하세요. 주문하시겠어요?',
          '메뉴 보셨어요? 추천 드릴까요?'
        ]
      },
      {
        id: 'introduction',
        title: 'Meeting Someone New',
        description: 'Introduce yourself and make small talk',
        systemPrompt: 'You are meeting a new person who is learning Korean. Be friendly and encouraging. Ask simple questions about them. Keep responses short. Help them practice.',
        openingLines: [
          '안녕하세요. 처음 뵙겠습니다.',
          '반가워요. 이름이 뭐예요?',
          '안녕하세요. 한국어를 배우고 있어요?'
        ]
      }
    ];
  }

  getScenarios() {
    return this.scenarios;
  }

  async startConversation(scenarioId) {
    const scenario = this.scenarios.find(s => s.id === scenarioId);
    if (!scenario) return null;

    const openingLine = scenario.openingLines[
      Math.floor(Math.random() * scenario.openingLines.length)
    ];

    this.history = [
      { role: 'system', content: scenario.systemPrompt },
      { role: 'assistant', content: openingLine }
    ];

    await audioEngine.speakKorean(openingLine);

    return {
      scenario,
      message: openingLine,
      isOpening: true
    };
  }

  async processUserSpeech(transcript) {
    this.history.push({ role: 'user', content: transcript });

    store.setState({ isAIResponding: true });

    try {
      const response = await this._getAIResponse();
      this.history.push({ role: 'assistant', content: response });

      await audioEngine.speakKorean(response);

      const state = store.getState();
      store.setState({
        isAIResponding: false,
        aiConversations: (state.aiConversations || 0) + 1,
        conversationHistory: [...state.conversationHistory, {
          user: transcript,
          ai: response,
          timestamp: new Date().toISOString()
        }]
      });

      return { success: true, message: response };
    } catch (error) {
      console.error('AI conversation error:', error);
      store.setState({ isAIResponding: false });

      const fallbackResponses = [
        '잘 들렸어요. 계속해 보세요.',
        '좋아요! 다시 한 번 말해 보세요.',
        '멋져요! 조금만 더 연습해요.'
      ];
      const fallback = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
      await audioEngine.speakKorean(fallback);

      return { success: true, message: fallback, isFallback: true };
    }
  }

  async _getAIResponse() {
    const apiKey = window.CONFIG?.GEMINI_API_KEY;

    if (!apiKey) {
      return this._getSimulatedResponse();
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: this.history.map(msg => ({
              role: msg.role === 'assistant' ? 'model' : msg.role,
              parts: [{ text: msg.content }]
            })),
            generationConfig: {
              maxOutputTokens: 100,
              temperature: 0.7
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }

      throw new Error('Empty response from API');
    } catch (error) {
      console.warn('Gemini API failed, using simulation:', error);
      return this._getSimulatedResponse();
    }
  }

  _getSimulatedResponse() {
    const userMsg = this.history.filter(m => m.role === 'user').pop()?.content || '';

    const responses = {
      'default': [
        '잘했어요! 계속 연습하세요.',
        '좋아요! 발음이 좋네요.',
        '멋져요! 다음 문장도 항 보세요.',
        '잘 들렸어요. 한국어를 잘하시네요!',
        '좋습니다! 조금만 더 연습하면 완벽해요.',
        '대단해요! 계속항 보세요.'
      ],
      'greeting': [
        '안녕하세요! 반가워요.',
        '네, 안녕하세요! 잘 지내세요?',
        '안녕하세요! 오늘 기분이 어때요?'
      ],
      'food': [
        '맛있게 드세요!',
        '좋은 선택이에요!',
        '추천 메뉴예요. 즐겁게 드세요!'
      ],
      'price': [
        '만 원이에요.',
        '천 원이에요.',
        '이만 원이에요.'
      ]
    };

    let category = 'default';
    if (userMsg.includes('안녕') || userMsg.includes('반가')) category = 'greeting';
    else if (userMsg.includes('먹') || userMsg.includes('마') || userMsg.includes('주문')) category = 'food';
    else if (userMsg.includes('얼마') || userMsg.includes('돈') || userMsg.includes('원')) category = 'price';

    const pool = responses[category] || responses.default;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  reset() {
    this.history = [];
  }
}

const aiConversation = new AIConversation();

export { aiConversation };
