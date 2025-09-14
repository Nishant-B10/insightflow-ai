import React, { useState, useEffect } from 'react';
import { TrendingUp, Upload, Database, Loader2, CheckCircle, AlertCircle, FileText, MessageCircle, Send, Bot, User, BarChart3, Download } from 'lucide-react';
import { auth, db } from './firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  AreaChart,
  Area
} from 'recharts';

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
  const [visualizations, setVisualizations] = useState([]);

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

  // Set current dataset and generate visualizations
  useEffect(() => {
    if (datasets.length > 0 && !currentDataset) {
      setCurrentDataset(datasets[0]);
    }
  }, [datasets, currentDataset]);

  // Generate automatic visualizations when dataset changes
  useEffect(() => {
    if (currentDataset) {
      const autoVisualizations = generateAutomaticVisualizations(currentDataset);
      setVisualizations(autoVisualizations);
    }
  }, [currentDataset]);

  // Add welcome message when dataset is selected
  useEffect(() => {
    if (currentDataset && chatMessages.length === 0) {
      const welcomeMessage = {
        id: Date.now(),
        type: 'ai',
        content: `I can see you've uploaded "${currentDataset.name}" with ${currentDataset.rowCount} rows and ${currentDataset.columnCount} columns. I've automatically generated visualizations and I'm ready to provide real AI-powered analysis of your data!

You can ask me things like:
- "What insights do you see in this data?"
- "Analyze the regional performance patterns"
- "What trends are most significant?"
- "What recommendations do you have?"

I'll analyze your actual data and provide specific insights. What would you like to explore?`,
        timestamp: new Date()
      };
      setChatMessages([welcomeMessage]);
    }
  }, [currentDataset, chatMessages.length]);

  // Real Claude API call through Netlify function
  const callRealClaudeAPI = async (message, dataContext) => {
    try {
      const apiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:8888/.netlify/functions/analyze-data'
        : '/.netlify/functions/analyze-data';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          dataContext
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.response;

    } catch (error) {
      console.error('Real AI API error:', error);
      return `I'm having trouble connecting to the AI service: ${error.message}. This could be because the Netlify functions aren't deployed yet or there's a configuration issue.`;
    }
  };

  // Handle chat submission with real AI
  const handleChatSubmit = async () => {
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

    try {
      const aiResponse = await callRealClaudeAPI(currentInput, currentDataset);
      
      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: aiResponse,
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'error',
        content: `Error: ${error.message}`,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Automatic visualization generation
  const generateAutomaticVisualizations = (dataset) => {
    if (!dataset || !dataset.data || dataset.data.length === 0) return [];

    const data = dataset.data;
    const sampleRow = data[0];
    const columns = Object.keys(sampleRow).filter(key => key !== '_rowIndex');
    
    const visualizations = [];
    
    // Detect column types
    const numericColumns = [];
    const categoricalColumns = [];
    const dateColumns = [];
    
    columns.forEach(col => {
      const sampleValues = data.slice(0, 5).map(row => row[col]);
      const numericValues = sampleValues.filter(val => !isNaN(parseFloat(val)) && isFinite(val));
      const uniqueValues = [...new Set(sampleValues)];
      
      if (numericValues.length >= 3) {
        numericColumns.push(col);
      } else if (uniqueValues.length <= Math.min(10, data.length * 0.7)) {
        categoricalColumns.push(col);
      } else if (sampleValues.some(val => !isNaN(Date.parse(val)))) {
        dateColumns.push(col);
      }
    });

    // Generate bar chart for categorical vs numeric data
    if (categoricalColumns.length > 0 && numericColumns.length > 0) {
      const categoricalCol = categoricalColumns[0];
      const numericCol = numericColumns[0];
      
      // Aggregate data by category
      const aggregated = data.reduce((acc, row) => {
        const category = row[categoricalCol];
        const value = parseFloat(row[numericCol]) || 0;
        acc[category] = (acc[category] || 0) + value;
        return acc;
      }, {});

      const chartData = Object.entries(aggregated)
        .map(([key, value]) => ({ [categoricalCol]: key, [numericCol]: value }))
        .sort((a, b) => b[numericCol] - a[numericCol])
        .slice(0, 10);

      visualizations.push({
        id: 'auto-bar-1',
        type: 'bar',
        title: `${numericCol} by ${categoricalCol}`,
        data: chartData,
        xAxis: categoricalCol,
        yAxis: numericCol
      });
    }

    // Generate line chart for time series data
    if (dateColumns.length > 0 && numericColumns.length > 0) {
      const dateCol = dateColumns[0];
      const numericCol = numericColumns[0];
      
      const timeSeriesData = data
        .filter(row => row[dateCol] && row[numericCol])
        .map(row => ({
          [dateCol]: row[dateCol],
          [numericCol]: parseFloat(row[numericCol]) || 0
        }))
        .sort((a, b) => new Date(a[dateCol]) - new Date(b[dateCol]));

      if (timeSeriesData.length > 1) {
        visualizations.push({
          id: 'auto-line-1',
          type: 'line',
          title: `${numericCol} Over Time`,
          data: timeSeriesData.slice(0, 50),
          xAxis: dateCol,
          yAxis: numericCol
        });
      }
    }

    // Generate pie chart for categorical data distribution
    if (categoricalColumns.length > 0) {
      const categoricalCol = categoricalColumns[0];
      const distribution = data.reduce((acc, row) => {
        const category = row[categoricalCol];
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});

      const pieData = Object.entries(distribution)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

      visualizations.push({
        id: 'auto-pie-1',
        type: 'pie',
        title: `Distribution of ${categoricalCol}`,
        data: pieData
      });
    }

    // Generate scatter plot for numeric correlations
    if (numericColumns.length >= 2) {
      const xCol = numericColumns[0];
      const yCol = numericColumns[1];
      
      const scatterData = data
        .filter(row => row[xCol] && row[yCol])
        .map(row => ({
          [xCol]: parseFloat(row[xCol]) || 0,
          [yCol]: parseFloat(row[yCol]) || 0
        }))
        .slice(0, 100);

      visualizations.push({
        id: 'auto-scatter-1',
        type: 'scatter',
        title: `${xCol} vs ${yCol}`,
        data: scatterData,
        xAxis: xCol,
        yAxis: yCol
      });
    }

    return visualizations;
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
      setChatMessages([]);

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

  // CSV Export function
  const exportToCSV = () => {
    if (!currentDataset) return;

    const csvContent = "data:text/csv;charset=utf-8,";
    const headers = Object.keys(currentDataset.data[0]).filter(key => key !== '_rowIndex');
    const rows = [
      headers.join(','),
      ...currentDataset.data.map(row => 
        headers.map(header => row[header]).join(',')
      )
    ];
    
    const csv = csvContent + rows.join('\n');
    const encodedUri = encodeURI(csv);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${currentDataset.name}-export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Visualization component
  const VisualizationChart = ({ viz }) => {
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7300'];

    const renderChart = () => {
      switch (viz.type) {
        case 'bar':
          return (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={viz.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={viz.xAxis} angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey={viz.yAxis} fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          );
          
        case 'line':
          return (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={viz.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={viz.xAxis} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey={viz.yAxis} stroke="#3B82F6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          );
          
        case 'pie':
          return (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={viz.data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {viz.data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          );
          
        case 'scatter':
          return (
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart data={viz.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={viz.xAxis} />
                <YAxis dataKey={viz.yAxis} />
                <Tooltip />
                <Scatter dataKey={viz.yAxis} fill="#3B82F6" />
              </ScatterChart>
            </ResponsiveContainer>
          );
          
        default:
          return <div>Chart type not supported</div>;
      }
    };

    return (
      <div className="bg-white p-4 rounded-lg border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{viz.title}</h3>
          <button
            onClick={() => {/* TODO: Add chart image export */}}
            className="text-gray-500 hover:text-blue-600"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
        {renderChart()}
        <div className="mt-2 text-xs text-gray-500">
          Data points: {viz.data?.length || 0}
        </div>
      </div>
    );
  };

  // Loading and error states
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
              <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full">
                Real AI
              </span>
            </div>
            <div className="flex items-center space-x-4">
              {currentDataset && (
                <button
                  onClick={exportToCSV}
                  className="flex items-center space-x-1 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                >
                  <Download className="h-3 w-3" />
                  <span>Export CSV</span>
                </button>
              )}
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
          {/* Upload Section - Smaller */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow border">
              <div className="p-4">
                <h2 className="text-lg font-semibold mb-4">Upload Data</h2>
                
                <div 
                  className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                    dragActive 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <input
                    type="file"
                    accept=".csv,.json,.txt"
                    onChange={handleFileInput}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="bg-blue-600 text-white px-3 py-2 rounded cursor-pointer hover:bg-blue-700 transition-colors text-sm"
                  >
                    Choose File
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    CSV, JSON (Max: 10MB)
                  </p>
                </div>

                {uploadProgress && (
                  <div className="mt-3 p-3 rounded-lg bg-gray-50">
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
                      <p className="text-red-600 text-xs">{uploadProgress.message}</p>
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
            <div className="bg-white rounded-lg shadow border mt-4">
              <div className="p-3 border-b">
                <h2 className="font-semibold text-sm">Your Datasets</h2>
              </div>
              <div className="p-3">
                {datasets.length === 0 ? (
                  <div className="text-center py-4">
                    <Database className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 text-xs">No datasets uploaded yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {datasets.map((dataset) => (
                      <div 
                        key={dataset.id} 
                        className={`p-2 border rounded cursor-pointer transition-colors ${
                          currentDataset?.id === dataset.id 
                            ? 'border-blue-300 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setCurrentDataset(dataset)}
                      >
                        <div className="flex items-start space-x-2">
                          <FileText className="h-3 w-3 text-blue-500 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-xs truncate">{dataset.name}</h3>
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

          {/* Main Content - Larger */}
          <div className="lg:col-span-9">
            {/* Visualizations Section */}
            {visualizations.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center space-x-2 mb-4">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  <h2 className="text-xl font-bold text-gray-900">Data Visualizations</h2>
                  <span className="text-sm text-gray-500">({visualizations.length} charts)</span>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {visualizations.map((viz) => (
                    <VisualizationChart key={viz.id} viz={viz} />
                  ))}
                </div>
              </div>
            )}

            {/* AI Chat Section */}
            <div className="bg-white rounded-lg shadow border h-80 flex flex-col">
              <div className="p-4 border-b">
                <div className="flex items-center space-x-2">
                  <Bot className="h-5 w-5 text-blue-600" />
                  <h2 className="font-semibold">Real AI Data Analyst</h2>
                  {currentDataset && (
                    <span className="text-sm text-gray-600">
                      analyzing "{currentDataset.name}"
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {!currentDataset ? (
                  <div className="text-center py-8">
                    <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Upload a dataset to start chatting with Real AI</p>
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
                            : message.type === 'error'
                            ? 'bg-red-50 text-red-800 border border-red-200'
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

              <div className="p-4 border-t">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
                    placeholder={currentDataset ? "Ask about your data for real AI analysis..." : "Upload data first to chat"}
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
                Welcome to InsightFlow AI with Real AI
              </h2>
              <p className="text-gray-600 mb-6">
                Upload your dataset to automatically generate intelligent visualizations and chat with real Claude AI about your data.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">📊 Auto Visualizations</h3>
                  <p className="text-blue-700">Smart charts generated automatically</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <h3 className="font-semibold text-green-900 mb-2">🤖 Real AI Analysis</h3>
                  <p className="text-green-700">Genuine Claude AI insights</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold text-purple-900 mb-2">📥 Data Export</h3>
                  <p className="text-purple-700">Download processed data and charts</p>
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