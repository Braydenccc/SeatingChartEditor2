const fs = require('fs');
const file = 'src/components/layout/ExportPreview.vue';
let content = fs.readFileSync(file, 'utf8');

// handleExcelDownload and handleCloudExportExcel options
content = content.replace(
  /colorMode:        es\.excelColorMode,\s+borderColor:      es\.excelBorderColor,\s+cellFormat:       es\.excelCellFormat,/g,
  `colorMode:        es.excelColorMode,
        borderColor:      es.excelBorderColor,
        showBorders:      es.excelShowBorders,
        borderStyle:      es.excelBorderStyle,
        cellFormat:       es.excelCellFormat,`
);

fs.writeFileSync(file, content);
console.log('Successfully updated the rest of ExportPreview.vue!');
  