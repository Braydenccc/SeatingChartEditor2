const fs = require('fs');
const file = 'src/components/layout/ExportPreview.vue';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /const cssStyle = bs === 'dashed' \? 'dashed' : 'solid'\s+const cssWidth = bs === 'medium' \? '2px' : '1px'\s+css \+= `border-\$\{edge\}:\$\{cssWidth\} \$\{cssStyle\} #\$\{bc\};`/g,
  `const cssStyle = (bs === 'dashed' || bs === 'dotted') ? bs : 'solid'
          let cssWidth = '1px'
          if (bs === 'medium') cssWidth = '2px'
          if (bs === 'thick') cssWidth = '3px'
          css += \`border-\${edge}:\${cssWidth} \${cssStyle} #\${bc} !important;\``
);


content = content.replace(
  /\/\/ Excel 单元格基础重置样式（默认添加网格线占位）\s+tdAttr \+= `padding:0 4px;box-sizing:border-box;background:#fff;overflow:hidden;border:1px solid #d4d4d4;`/g,
  `// Excel 单元格基础重置样式
      tdAttr += \`padding:0 4px;box-sizing:border-box;background:#fff;overflow:hidden;\`
      if (!exportSettings.value.excelShowBorders) {
        tdAttr += \`border:1px solid #e0e0e0;\`
      }`
);

fs.writeFileSync(file, content);
console.log('Successfully applied accurate preview bug fixes.');
