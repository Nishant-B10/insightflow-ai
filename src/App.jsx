import React, { useState, useEffect } from 'react';
import { TrendingUp, Upload, Database, Loader2, CheckCircle, AlertCircle, FileText, MessageCircle, Send, Bot, User } from 'lucide-react';
import { auth, db } from './firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [currentDataset, setCurrentDataset] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Authentication effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          setUser(user);
          setError(null);
        } else {
          const userCredential = await signInAnonymously(auth);
          setUser(userCredential.user);
        }
      } catch (error) {
        console.error('Authentication error:', error);
        setError(`Authentication failed: ${error.message}`);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Set current dataset when datasets change
  useEffect(() => {
    if (datasets.length > 0 && !currentDataset) {
      setCurrentDataset(datasets[0]);
    }
  }, [datasets, currentDataset]);

  // Add welcome message when dataset is selected
  useEffect(() => {
    if (currentDataset && chatMessages.length === 0) {
      const welcomeMessage = {
        id: Date.now(),
        type: 'ai',
        content: `I can see you've uploaded "${currentDataset.name}" with ${currentDataset.rowCount} rows and ${currentDataset.columnCount} columns. I'm ready to help you analyze this data!

You can ask me things like:
- "What patterns do you see in this data?"
- "Show me insights about the sales trends"
- "Which region performs best?"
- "What are the key findings?"

What would you like to explore first?`,
        timestamp: new Date()
      };
      setChatMessages([welcomeMessage]);
    }
  }, [currentDataset, chatMessages.length]);

  // Demo AI responses
  const getDemoResponse = (message, dataContext) => {
    const msg = message.toLowerCase();
    const dataName = dataContext?.name || 'your dataset';
    const rowCount = dataContext?.rowCount || 0;
    const columnCount = dataContext?.columnCount || 0;
    
    if (msg.includes('pattern') || msg.includes('see')) {
      return `Looking at "${dataName}" with ${rowCount} rows and ${columnCount} columns, I can see several interesting patterns:

- Sales Performance: Different widgets show varying performance levels
- Regional Trends: Some regions appear to outperform others
- Revenue Patterns: There's significant variation in daily revenue
- Product Mix: Your products have different revenue-per-unit ratios

The data suggests opportunities for optimization in both product focus and regional strategy.`;
    }
    
    if (msg.includes('trend') || msg.includes('sales')) {
      return `Sales trends analysis for "${dataName}":

- Daily sales volumes vary significantly 
- Revenue patterns show both high and low performing days
- Different products contribute varying amounts to total revenue
- Regional performance shows interesting variations

Consider focusing on your highest-performing product/region combinations for growth.`;
    }
    
    if (msg.includes('region') || msg.includes('best')) {
      return `Regional performance insights:

Based on your ${rowCount} data points, I can see variations in regional performance. Some regions consistently generate higher revenue per transaction, while others may have volume advantages.

This suggests opportunities for:
- Regional strategy optimization
- Product mix adjustments by region  
- Targeted marketing approaches

Which specific region would you like me to analyze further?`;
    }
    
    return `I'm analyzing your "${dataName}" dataset with ${rowCount} rows and ${columnCount} columns. 

To provide more specific insights, try asking:
- "What are the sales trends?"
- "Which region performs best?"  
- "Show me key insights"
- "What patterns do you see?"

What specific aspect would you like me to explore?`;
  };

  // Handle chat submission
  const handleChatSubmit = () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: chatInput.trim(),
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    const currentInput = chatInput.trim();
    setChatInput('');
    setIsChatLoading(true);

    // Simulate AI processing delay
    setTimeout(() => {
      const aiResponse = getDemoResponse(currentInput, currentDataset);
      
      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: aiResponse,
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, aiMessage]);
      setIsChatLoading(false);
    }, 1500);
  };

  // File processing function
  const processFile = async (file) => {
    setUploadProgress({ status: 'uploading', progress: 0 });
    
    try {
      let parsedData = [];
      const fileName = file.name;
      const fileType = fileName.split('.').pop().toLowerCase();

      if (!['csv', 'json', 'txt'].includes(fileType)) {
        throw new Error('Unsupported file format. Please upload CSV or JSON files.');
      }

      setUploadProgress({ status: 'processing', progress: 30 });

      const text = await file.text();
      
      if (fileType === 'csv' || fileType === 'txt') {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          throw new Error('CSV file must have at least a header row and one data row.');
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        parsedData = lines.slice(1).map((line, index) => {
          const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
          const row = { _rowIndex: index + 1 };
          headers.forEach((header, idx) => {
            let value = values[idx] || '';
            if (value && !isNaN(value) && !isNaN(parseFloat(value))) {
              value = parseFloat(value);
            }
            row[header] = value;
          });
          return row;
        }).filter(row => Object.values(row).some(v => v !== '' && v !== null));

      } else if (fileType === 'json') {
        const jsonData = JSON.parse(text);
        parsedData = Array.isArray(jsonData) ? jsonData : [jsonData];
      }

      if (parsedData.length === 0) {
        throw new Error('No valid data found in file.');
      }

      setUploadProgress({ status: 'saving', progress: 70 });

      const datasetDoc = await addDoc(collection(db, 'users', user.uid, 'datasets'), {
        name: fileName.replace(/\.[^/.]+$/, ""),
        fileName: fileName,
        fileType: fileType,
        uploadedAt: serverTimestamp(),
        rowCount: parsedData.length,
        columnCount: Object.keys(parsedData[0] || {}).length - 1,
        data: parsedData.slice(0, 1000),
        preview: parsedData.slice(0, 5)
      });

      setUploadProgress({ status: 'complete', progress: 100 });

      const newDataset = {
        id: datasetDoc.id,
        name: fileName.replace(/\.[^/.]+$/, ""),
        fileName: fileName,
        fileType: fileType,
        uploadedAt: new Date(),
        rowCount: parsedData.length,
        columnCount: Object.keys(parsedData[0] || {}).length - 1,
        data: parsedData.slice(0, 1000),
        preview: parsedData.slice(0, 5)
      };

      setDatasets(prev => [newDataset, ...prev]);
      setChatMessages([]); // Reset chat for new dataset

      setTimeout(() => setUploadProgress(null), 2000);

    } catch (error) {
      console.error('File processing error:', error);
      setUploadProgress({ status: 'error', message: error.message });
      setTimeout(() => setUploadProgress(null), 5000);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <div className="flex items-center space-x-3">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold">Loading InsightFlow AI</h2>
              <p className="text-gray-600">Connecting to Firebase...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <div className="flex items-center space-x-3 mb-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <h2 className="text-lg font-semibold text-gray-900">Connection Error</h2>
          </div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <TrendingUp className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">InsightFlow AI</h1>
              <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                Beta
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-600">Connected</span>
              </div>
              <div className="text-sm text-gray-600">
                Datasets: {datasets.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Upload Section */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-lg shadow border">
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4">Upload Your Data</h2>
                
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    dragActive 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                  <h3 className="font-medium text-gray-900 mb-2">
                    Drop your data file here
                  </h3>
                  <input
                    type="file"
                    accept=".csv,.json,.txt"
                    onChange={handleFileInput}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors text-sm"
                  >
                    Choose File
                  </label>
                  <p className="text-xs text-gray-500 mt-2">
                    CSV, JSON (Max: 10MB)
                  </p>
                </div>

                {uploadProgress && (
                  <div className="mt-4 p-3 rounded-lg bg-gray-50">
                    <div className="flex items-center space-x-2 mb-2">
                      {uploadProgress.status === 'error' ? (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      )}
                      <span className="text-sm font-medium capitalize">
                        {uploadProgress.status === 'error' ? 'Error' : uploadProgress.status}
                      </span>
                    </div>
                    {uploadProgress.status === 'error' ? (
                      <p className="text-red-600 text-sm">{uploadProgress.message}</p>
                    ) : (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${uploadProgress.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Datasets List */}
            <div className="bg-white rounded-lg shadow border mt-6">
              <div className="p-4 border-b">
                <h2 className="font-semibold">Your Datasets</h2>
              </div>
              <div className="p-4">
                {datasets.length === 0 ? (
                  <div className="text-center py-6">
                    <Database className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No datasets uploaded yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {datasets.map((dataset) => (
                      <div 
                        key={dataset.id} 
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          currentDataset?.id === dataset.id 
                            ? 'border-blue-300 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setCurrentDataset(dataset)}
                      >
                        <div className="flex items-start space-x-2">
                          <FileText className="h-4 w-4 text-blue-500 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate">{dataset.name}</h3>
                            <p className="text-xs text-gray-500">
                              {dataset.rowCount} rows × {dataset.columnCount} cols
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Chat Section */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-lg shadow border h-96 flex flex-col">
              <div className="p-4 border-b">
                <div className="flex items-center space-x-2">
                  <Bot className="h-5 w-5 text-blue-600" />
                  <h2 className="font-semibold">AI Data Analyst</h2>
                  {currentDataset && (
                    <span className="text-sm text-gray-600">
                      analyzing "{currentDataset.name}"
                    </span>
                  )}
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {!currentDataset ? (
                  <div className="text-center py-8">
                    <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Upload a dataset to start chatting with AI</p>
                  </div>
                ) : (
                  <>
                    {chatMessages.map((message) => (
                      <div key={message.id} className={`flex space-x-3 ${message.type === 'user' ? 'justify-end' : ''}`}>
                        {message.type !== 'user' && (
                          <div className="flex-shrink-0">
                            <Bot className="h-6 w-6 text-blue-600" />
                          </div>
                        )}
                        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.type === 'user' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                        </div>
                        {message.type === 'user' && (
                          <div className="flex-shrink-0">
                            <User className="h-6 w-6 text-gray-600" />
                          </div>
                        )}
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex space-x-3">
                        <Bot className="h-6 w-6 text-blue-600" />
                        <div className="bg-gray-100 px-4 py-2 rounded-lg">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
                    placeholder={currentDataset ? "Ask about your data..." : "Upload data first to chat"}
                    disabled={!currentDataset || isChatLoading}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                  <button
                    onClick={handleChatSubmit}
                    disabled={!currentDataset || !chatInput.trim() || isChatLoading}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Welcome Message for No Datasets */}
        {datasets.length === 0 && (
          <div className="mt-8 text-center">
            <div className="bg-white rounded-lg shadow p-8 max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Welcome to InsightFlow AI
              </h2>
              <p className="text-gray-600 mb-6">
                Upload your first dataset and start chatting with our AI data analyst. 
                Get intelligent insights, analysis, and visualizations instantly.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">1. Upload Data</h3>
                  <p className="text-blue-700">Drop CSV or JSON files to get started</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <h3 className="font-semibold text-green-900 mb-2">2. AI Analysis</h3>
                  <p className="text-green-700">Our AI analyzes patterns and structure</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold text-purple-900 mb-2">3. Chat & Insights</h3>
                  <p className="text-purple-700">Ask questions and get smart answers</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;