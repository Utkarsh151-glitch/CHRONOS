module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    status: "healthy",
    project: "CHRONOS",
    version: "2.0.0",
    model: "PyTorch LSTM(1->32) + Linear(32->1)",
    parameters: 4513,
    timestamp: new Date().toISOString()
  });
};
