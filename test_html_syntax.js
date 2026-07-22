/**
 * 提取 HTML 中的内联 <script> 并做语法检查
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = ['index.html', 'tasks.html', 'rewards.html', 'settings.html', 'sprint.html', 'stats.html'];

files.forEach(file => {
  const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
  const scriptMatches = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
  console.log(`\n${file}: ${scriptMatches.length} inline script(s)`);

  scriptMatches.forEach((match, idx) => {
    const code = match.replace(/<script>/, '').replace(/<\/script>/, '');
    try {
      new vm.Script(code, { filename: `${file}:script${idx + 1}` });
      console.log(`  ✓ script${idx + 1} syntax OK`);
    } catch (err) {
      console.log(`  ✗ script${idx + 1} ERROR: ${err.message}`);
      process.exitCode = 1;
    }
  });
});

console.log('\nDone');
