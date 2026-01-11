#!/usr/bin/env node
/**
 * console.log를 Winston logger로 마이그레이션하는 스크립트
 * 안전하게 각 파일을 읽고 교체합니다.
 */

const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../routes');

// Logger import 문
const LOGGER_IMPORT = "const logger = require('../utils/logger');";

// 교체 규칙
const replacements = [
  { from: /console\.log\(/g, to: 'logger.info(' },
  { from: /console\.error\(/g, to: 'logger.error(' },
  { from: /console\.warn\(/g, to: 'logger.warn(' },
  { from: /console\.info\(/g, to: 'logger.info(' },
  { from: /console\.debug\(/g, to: 'logger.debug(' }
];

function migrateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  // console이 사용되지 않으면 스킵
  if (!content.includes('console.')) {
    return { modified: false, fileName: path.basename(filePath) };
  }

  let newContent = content;

  // logger import가 없으면 추가
  if (!newContent.includes("require('../utils/logger')")) {
    // require 문들 중 마지막에 추가
    const requireLines = newContent.match(/const .+ = require\(.+\);/g);
    if (requireLines && requireLines.length > 0) {
      const lastRequire = requireLines[requireLines.length - 1];
      const insertPosition = newContent.indexOf(lastRequire) + lastRequire.length;
      newContent =
        newContent.slice(0, insertPosition) +
        '\n' + LOGGER_IMPORT +
        newContent.slice(insertPosition);
    } else {
      // require 문이 없으면 파일 시작 부분에 추가
      newContent = LOGGER_IMPORT + '\n\n' + newContent;
    }
  }

  // console.* → logger.* 교체
  replacements.forEach(({ from, to }) => {
    newContent = newContent.replace(from, to);
  });

  // 변경사항이 있으면 파일 저장
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    return { modified: true, fileName: path.basename(filePath) };
  }

  return { modified: false, fileName: path.basename(filePath) };
}

function main() {
  console.log('🔄 console.log → logger 마이그레이션 시작...\n');

  const files = fs.readdirSync(routesDir)
    .filter(file => file.endsWith('.js'))
    .map(file => path.join(routesDir, file));

  const results = {
    total: files.length,
    modified: 0,
    skipped: 0
  };

  const modifiedFiles = [];

  files.forEach(filePath => {
    const result = migrateFile(filePath);
    if (result.modified) {
      results.modified++;
      modifiedFiles.push(result.fileName);
      console.log(`✅ ${result.fileName}`);
    } else {
      results.skipped++;
    }
  });

  console.log('\n==========================================');
  console.log('📊 마이그레이션 완료');
  console.log('==========================================');
  console.log(`총 파일: ${results.total}개`);
  console.log(`수정됨: ${results.modified}개`);
  console.log(`스킵됨: ${results.skipped}개`);
  console.log('==========================================');

  if (modifiedFiles.length > 0) {
    console.log('\n수정된 파일 목록:');
    modifiedFiles.forEach(file => console.log(`  - ${file}`));
  }
}

main();
