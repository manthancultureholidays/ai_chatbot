// 20 Hard Test Questions for LLM Comparison (Ollama vs vLLM)
// Based on your 100-question dataset

const testQuestions = [
  // Data Quality & Anomalies
  "How many records have malformed LOGINDATE fields with spaces in the timestamp?",
  "Which AGENTID appears with both uppercase and lowercase variants?",
  "Which email has a typo .comm instead of .com?",
  
  // Agent Frequency & Login Patterns
  "Which AGENTID has the highest number of login records?",
  "Which agent logged in most times on May 4, 2022?",
  "What is the earliest login timestamp in the dataset?",
  
  // Cultural Holidays Group
  "How many distinct agents are associated with cultureholidays.com domain?",
  "Which cultureholidays agent has the most login records?",
  "What AgentID is assigned to gautam@cultureholidays.com?",
  
  // Agent Registration Data
  "Which agent has the oldest company establishment date?",
  "Which nationality appears most frequently besides United States?",
  "How many agents list Inteletravel as their company?",
  
  // Cross-Document Matching
  "Does sweeterte@aol.com appear in both documents?",
  "What is the full registered name of blissfultravel2021@gmail.com?",
  
  // Login Behavior Analysis
  "Which agent logged in twice within 10 seconds on May 4?",
  "Which agent logged in 4 times within 1 minute on May 4 around 23:52?",
  
  // Company & Network Analysis
  "Which travel network has the most agents?",
  "Which agent represents Atlas Cruises and Tours?",
  
  // Security & Anomaly Detection
  "Which agents logged in more than 5 times within a 10-minute window?",
  "Which agent shows login activity suggesting credential sharing?"
];

module.exports = testQuestions;
