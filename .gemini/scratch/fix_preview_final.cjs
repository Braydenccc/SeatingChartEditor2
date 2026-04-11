const fs = require('fs');
const file = 'src/components/layout/ExportPreview.vue';
let content = fs.readFileSync(file, 'utf8');

// 1. Update UI
content = content.replace(
  `<div class="setting-row" style="margin-top:6px">
                  <label>边框颜色:</label>
                  <input v-model="exportSettings.excelBorderColor" type="color" />
                </div>`,
  `<div class="setting-row" style="margin-top:6px">
                  <label>边框设置:</label>
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                    <label class="check-item" style="margin-left:0;margin-right:2px"><input type="checkbox" v-model="exportSettings.excelShowBorders" /><span>显示</span></label>
                    <select v-model="exportSettings.excelBorderStyle" :disabled="!exportSettings.excelShowBorders" style="width:68px;padding:2px">
                      <option value="thin">细实线</option>
                      <option value="medium">中实线</option>
                      <option value="thick">粗实线</option>
                      <option value="dashed">虚线</option>
                      <option value="dotted">点线</option>
                    </select>
                    <div style="display:flex;align-items:center;gap:4px;" :style="{ opacity: exportSettings.excelShowBorders ? 1 : 0.4 }">
                      <span>颜色</span>
                      <input v-model="exportSettings.excelBorderColor" type="color" :disabled="!exportSettings.excelShowBorders" />
                    </div>
                  </div>
                </div>`
);

// 2. Update getCssFromStyle to fully support dashed/dotted/thick and add !important.
content = content.replace(
  `          const cssStyle = bs === 'dashed' ? 'dashed' : 'solid'
          const cssWidth = bs === 'medium' ? '2px' : '1px'
          css += \`border-\${edge}:\${cssWidth} \${cssStyle} #\${bc};\``,
  `          const cssStyle = (bs === 'dashed' || bs === 'dotted') ? bs : 'solid'
          let cssWidth = '1px'
          if (bs === 'medium') cssWidth = '2px'
          if (bs === 'thick') cssWidth = '3px'
          css += \`border-\${edge}:\${cssWidth} \${cssStyle} #\${bc} !important;\``
);


// 3. Update watch array
content = content.replace(
  `    exportSettings.value.excelColorMode,
    exportSettings.value.excelBorderColor,
    exportSettings.value.excelCellFormat,`,
  `    exportSettings.value.excelColorMode,
    exportSettings.value.excelBorderColor,
    exportSettings.value.excelShowBorders,
    exportSettings.value.excelBorderStyle,
    exportSettings.value.excelCellFormat,`
);

// 4. Update option maps internally (3 locations)
content = content.replace(
  /colorMode:        es\.excelColorMode,\s+borderColor:      es\.excelBorderColor,\s+cellFormat:       es\.excelCellFormat,/g,
  `colorMode:        es.excelColorMode,
        borderColor:      es.excelBorderColor,
        showBorders:      es.excelShowBorders,
        borderStyle:      es.excelBorderStyle,
        cellFormat:       es.excelCellFormat,`
);

fs.writeFileSync(file, content);
console.log('Successfully fully updated ExportPreview.vue using the final script!');
