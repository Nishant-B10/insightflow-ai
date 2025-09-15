export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }) 
    };
  }

  try {
    const { message, dataContext } = JSON.parse(event.body);
    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
    
    if (!CLAUDE_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Claude API key not configured' })
      };
    }

    let systemPrompt = `You are an expert data analyst. Analyze the provided dataset and give specific, actionable insights based on the actual data values. Always reference specific data points, column names, and values.`;
    
    if (dataContext && dataContext.data && dataContext.data.length > 0) {
      const columns = Object.keys(dataContext.data[0]).filter(key => key !== '_rowIndex');
      const sampleData = dataContext.data.slice(0, 3);
      
      systemPrompt += `

DATASET: "${dataContext.name}" (${dataContext.rowCount} rows)
COLUMNS: ${columns.join(', ')}
SAMPLE DATA: ${JSON.stringify(sampleData, null, 2)}

Analyze THIS specific data. Reference actual values from the data provided.`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const result = await response.json();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        response: result.content[0]?.text || 'No response received'
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};