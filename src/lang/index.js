const en = require('./en.json')
module.exports = (language) => {
  const languageConfig = {
    en
  }
  return languageConfig[language] || languageConfig['en']
}
