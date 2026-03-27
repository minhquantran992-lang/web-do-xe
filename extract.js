const fs = require('fs');
const content = fs.readFileSync('frontend/src/pages/AdminCars.jsx', 'utf8');

const matches = [];
const lines = content.split('\n');

const vietnameseRegex = /[àáãạảăẵẳằắặâấầẩẫậèéẹẻẽêềếểễệìíĩỉịòóõọỏôốồổỗộơớờởỡợùúũụủưứừửữựỳýỹỷỵđ]/i;

lines.forEach((line, i) => {
  if (vietnameseRegex.test(line)) {
    // Try to extract text inside quotes, backticks or JSX tags
    const m1 = line.match(/'([^']+)'/);
    if (m1 && vietnameseRegex.test(m1[1])) matches.push(m1[1]);
    
    const m2 = line.match(/`([^`]+)`/);
    if (m2 && vietnameseRegex.test(m2[1])) matches.push(m2[1]);
    
    const m3 = line.match(/>([^<]+)</);
    if (m3 && vietnameseRegex.test(m3[1])) matches.push(m3[1].trim());
  }
});

console.log(Array.from(new Set(matches)).join('\n'));
