exports.handler = async (event, context) => {
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
        body: JSON.stringify({ error: 'Claude API key not configured in Netlify environment' })
      };
    }

    // Prepare enhanced context for Claude
    let systemPrompt = `You are an expert data analyst. Analyze the provided dataset and give specific, actionable insights based on the actual data values and structure. Always reference specific data points, column names, and values from the dataset.`;
    
    let dataContextText = '';
    if (dataContext && dataContext.data && dataContext.data.length > 0) {
      const columns = Object.keys(dataContext.data[0]).filter(key => key !== '_rowIndex');
      const sampleData = dataContext.data.slice(0, 5);
      
      dataContextText = `

DATASET CONTEXT:
- Dataset Name: "${dataContext.name}"
- Total Rows: ${dataContext.rowCount}
- Columns: ${columns.join(', ')}

SAMPLE DATA (first 5 rows):
${JSON.stringify(sampleData, null, 2)}

ANALYSIS REQUIREMENTS:
1. Reference actual values from this data (specific product names, regions, numbers)
2. Use specific column names (${columns.join(', ')})
3. Provide concrete insights based on the numbers shown
4. Give actionable business recommendations
5. Be specific - mention actual values, not generic patterns

Analyze THIS specific data with real insights.`;
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
        system: systemPrompt + dataContextText,
        messages: [
          {
            role: 'user',
            content: message
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          error: `Claude API error: ${response.status}`,
          details: errorText.substring(0, 200)
        })
      };
    }

    const result = await response.json();
    const aiResponse = result.content[0]?.text || 'No response received from Claude AI';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        response: aiResponse,
        success: true
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};