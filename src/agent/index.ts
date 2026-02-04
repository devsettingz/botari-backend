import OpenAI from 'openai';
import { Pool } from 'pg';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const PERSONAS = {
  amina: {
    name: 'Botari Amina',
    role: 'WhatsApp Sales Specialist',
    tools: ['check_inventory', 'book_appointment', 'take_order', 'check_price'],
    prompt: `You are Botari Amina, a sales specialist for African small businesses via WhatsApp.
- Tone: Friendly, brief (max 2 sentences), professional but warm
- Use greetings like "Habari", "Asante", "How far?" when appropriate
- Never make up prices. Use tools to check inventory.
- Goal: Convert inquiries into sales or appointments`
  },
  
  stan: {
    name: 'Botari Stan',
    role: 'Sales Rep',
    tools: ['find_leads', 'send_email', 'schedule_followup', 'book_call'],
    prompt: `You are Botari Stan, a B2B sales development rep.
- Tone: Professional, concise, compelling
- Always include a clear CTA`
  }
};

type EmployeeType = keyof typeof PERSONAS;

export async function processMessage(
  text: string,
  userId: string,
  employeeType: EmployeeType = 'amina',
  businessContext: any = {},
  channel: string = 'whatsapp'
): Promise<{ reply: string; actions?: any[] }> {
  
  const persona = PERSONAS[employeeType];
  if (!persona) {
    throw new Error(`Unknown employee type: ${employeeType}`);
  }

  try {
    // Get or create conversation
    const convResult = await pool.query(
      `SELECT id FROM conversations WHERE customer_phone = $1 ORDER BY started_at DESC LIMIT 1`,
      [userId]
    );

    let conversationId: number;

    if (convResult.rows.length === 0) {
      const newConv = await pool.query(
        `INSERT INTO conversations (business_id, customer_phone, employee_id, status, started_at) 
         VALUES ($1, $2, $3, 'open', NOW()) RETURNING id`,
        [businessContext.business_id || 1, userId, employeeType === 'amina' ? 1 : 2]
      );
      conversationId = newConv.rows[0].id;
    } else {
      conversationId = convResult.rows[0].id;
    }

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: `${persona.prompt}\nBusiness: ${businessContext.business_name || 'Unknown'}` 
        },
        { role: 'user', content: text }
      ],
      temperature: 0.7,
      max_tokens: 200
    });

    // CRITICAL FIX: Check if choices exists
    if (!completion.choices || !Array.isArray(completion.choices) || completion.choices.length === 0) {
      console.error('OpenAI returned no choices');
      return { reply: "I'm thinking about that... let me get back to you.", actions: [] };
    }

    const choice = completion.choices[0];
    
    if (!choice || !choice.message) {
      console.error('OpenAI returned empty message');
      return { reply: "I'm having trouble thinking right now.", actions: [] };
    }

    const reply = choice.message.content || "I received your message!";

    // Save to database
    await pool.query(
      `INSERT INTO messages (conversation_id, role, content, created_at) VALUES ($1, 'assistant', $2, NOW())`,
      [conversationId, reply]
    );
    
    await pool.query(
      `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
      [conversationId]
    );

    return { reply, actions: [] };

  } catch (error) {
    console.error(`[${employeeType}] Error:`, error);
    return { reply: "Sorry, I'm having trouble connecting. Please try again.", actions: [] };
  }
}

export async function routeMessage(
  text: string,
  userId: string,
  channel: string,
  businessId: number
): Promise<string> {
  
  try {
    const result = await pool.query(
      `SELECT e.name as employee_name FROM channels c
       JOIN ai_employees e ON c.assigned_employee_id = e.id
       WHERE c.business_id = $1 AND c.channel_type = $2 AND c.is_active = true`,
      [businessId, channel]
    );

    const employeeName = (result.rows[0]?.employee_name || 'amina') as EmployeeType;
    const response = await processMessage(text, userId, employeeName, { business_id: businessId }, channel);
    return response.reply;
    
  } catch (error) {
    console.error('Route error:', error);
    return "Sorry, I'm having trouble right now.";
  }
}

export { PERSONAS };
export type { EmployeeType };

export default { processMessage, routeMessage, PERSONAS };