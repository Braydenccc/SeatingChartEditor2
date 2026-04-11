const fs = require('fs');
const file = 'src/components/layout/ExportPreview.vue';
let content = fs.readFileSync(file, 'utf8');

// 1. Add borders to template UI
content = content.replace(
  /<label>边框颜色:<\/label>\s*<input v-model="exportSettings\.excelBorderColor" type="color" \/>/,
  `<label>边框颜色:</label>
                  <input v-model="exportSettings.excelBorderColor" type="color" />
                  <label class="check-item" style="margin-left: 12px;">
                    <input type="checkbox" v-model="exportSettings.excelShowBorders" />
                    <span>显示边框</span>
                  </label>
                  <div style="margin-left: 12px; display: inline-flex; align-items: center; gap: 4px;">
                    <label style="margin-right: 4px;">样式:</label>
                    <select v-model="exportSettings.excelBorderStyle">
                      <option value="thin">细 (Thin)</option>
                      <option value="medium">中 (Medium)</option>
                      <option value="thick">粗 (Thick)</option>
                      <option value="dashed">虚线 (Dashed)</option>
                      <option value="dotted">点线 (Dotted)</option>
                    </select>
                  </div>`
);

// 2. Add watch variables
content = content.replace(
  /exportSettings\.value\.excelColorMode,\s*exportSettings\.value\.excelBorderColor,/,
  `exportSettings.value.excelColorMode,
    exportSettings.value.excelShowBorders,
    exportSettings.value.excelBorderStyle,
    exportSettings.value.excelBorderColor,`
);

// 3. Parse fill color
content = content.replace(
  /css \+= \`border-\$\{edge\}:\$\{cssWidth\} \$\{cssStyle\} #\$\{bc\} !important;\`\s*\}\s*\}\s*\}\s*return css\s*\}/,
  `css += \`border-\${edge}:\${cssWidth} \${cssStyle} #\${bc} !important;\`
        }
      }
    }
    if (style.fill && style.fill.fgColor && style.fill.fgColor.rgb) {
      css += \`background-color:#\${style.fill.fgColor.rgb} !important;\`
    }
    return css
  }`
);

fs.writeFileSync(file, content);
console.log('Successfully updated ExportPreview.vue via script!');
