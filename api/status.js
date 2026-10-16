// Tells the page which online features are configured. No secrets are returned.
const { kv } = require('./_lib');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ai: !!(process.env.ANTHROPIC_API_KEY && process.env.APP_PASSWORD),
    sync: !!(kv() && process.env.APP_PASSWORD),
    tts: !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION && process.env.APP_PASSWORD),
  });
};
